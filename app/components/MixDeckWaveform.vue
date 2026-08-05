<template>
  <section class="mix-waveform" :aria-label="ariaLabel" role="group">
    <svg ref="svgRef" class="mix-waveform__svg" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true"
      @pointerdown="onWavePointerDown" @pointermove="onWavePointerMove" @pointerup="onWavePointerUp"
      @pointercancel="onWavePointerUp" @pointerleave="onWavePointerUp">
      <rect class="mix-waveform__progress" x="0" y="0" :width="`${progressPercent}%`" height="24" />
      <rect v-for="(peak, index) in peaks" :key="index" class="mix-waveform__bar" :x="`${index * barStep}%`"
        :y="`${12 - ((peak * 22) / 2)}`" :width="`${barWidth}%`" :height="`${Math.max(1, peak * 22)}`" rx="0.7"
        ry="0.7" />
      <line class="mix-waveform__playhead" :x1="progressPercent" y1="0" :x2="progressPercent" y2="24" />
    </svg>
    <input class="range range-xs mix-waveform__seek" type="range" min="0" :max="safeDuration" step="0.01"
      :value="seekValue" :disabled="safeDuration <= 0" @pointerdown="isScrubbing = true" @pointerup="onScrubEnd"
      @input="onSeekInput" @change="onSeekChange" />
    <div class="mix-waveform__time">
      <span>{{ formatTime(seekValue) }}</span>
      <span>{{ formatTime(safeDuration) }}</span>
    </div>
    <span v-if="isLoading" class="mix-waveform__status">Analyse...</span>
    <span v-else-if="hasError" class="mix-waveform__status">Wave indisponible</span>
  </section>
</template>

<script setup lang="ts">
import type { Card as CardType } from '~~/types/types'

const BAR_COUNT = 180
const waveformCache = new Map<string, number[]>()

const props = defineProps<{
  card: CardType | null
  label?: string
  currentTime?: number
  duration?: number
}>()

const emit = defineEmits<{
  seek: [seconds: number]
}>()

const { resolveMediaUrl } = useMediaUrl()

const isLoading = ref(false)
const hasError = ref(false)
const peaks = ref<number[]>(Array.from({ length: BAR_COUNT }, () => 0.08))
const isScrubbing = ref(false)
const scrubValue = ref(0)
const isWaveDragging = ref(false)
const svgRef = ref<SVGSVGElement | null>(null)

const barStep = 100 / BAR_COUNT
const barWidth = Math.max(0.6, barStep * 0.62)

const safeDuration = computed(() => {
  const duration = Number(props.duration || 0)
  if (!Number.isFinite(duration) || duration <= 0) {
    return 0
  }

  return duration
})

const safeCurrentTime = computed(() => {
  const duration = safeDuration.value
  if (duration <= 0) {
    return 0
  }

  const current = Number(props.currentTime || 0)
  if (!Number.isFinite(current)) {
    return 0
  }

  return Math.max(0, Math.min(current, duration))
})

const seekValue = computed(() => {
  if (isScrubbing.value) {
    return scrubValue.value
  }

  return safeCurrentTime.value
})

const progressPercent = computed(() => {
  const duration = safeDuration.value
  if (duration <= 0) {
    return 0
  }

  return (seekValue.value / duration) * 100
})

const ariaLabel = computed(() => {
  if (!props.card) {
    return `Waveform deck ${props.label || ''}`.trim()
  }

  return `Waveform ${props.card.artist} - ${props.card.title}`
})

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '00:00'
  }

  const totalSeconds = Math.floor(seconds)
  const minutes = Math.floor(totalSeconds / 60)
  const remainingSeconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

const computePeaks = (samples: Float32Array, barCount: number) => {
  if (!samples.length || barCount <= 0) {
    return Array.from({ length: barCount }, () => 0.08)
  }

  const blockSize = Math.max(1, Math.floor(samples.length / barCount))
  const result = new Array<number>(barCount)
  let maxPeak = 0

  for (let index = 0; index < barCount; index += 1) {
    const offset = index * blockSize
    let blockPeak = 0
    let blockSum = 0

    for (let cursor = 0; cursor < blockSize && offset + cursor < samples.length; cursor += 1) {
      const amplitude = Math.abs(samples[offset + cursor] || 0)
      blockSum += amplitude
      if (amplitude > blockPeak) {
        blockPeak = amplitude
      }
    }

    const blockAverage = blockSum / blockSize
    const weightedPeak = (blockPeak * 0.72) + (blockAverage * 0.28)

    result[index] = weightedPeak
    if (weightedPeak > maxPeak) {
      maxPeak = weightedPeak
    }
  }

  const normalizer = maxPeak > 0 ? maxPeak : 1

  return result.map((value) => {
    const normalized = value / normalizer
    return Math.max(0.08, Math.min(1, normalized))
  })
}

const loadWaveform = async (card: CardType | null) => {
  if (!import.meta.client || !card?.url_audio) {
    peaks.value = Array.from({ length: BAR_COUNT }, () => 0.08)
    hasError.value = false
    return
  }

  const audioUrl = resolveMediaUrl(card.url_audio)
  if (!audioUrl) {
    peaks.value = Array.from({ length: BAR_COUNT }, () => 0.08)
    hasError.value = false
    return
  }

  const cacheKey = `${card.slug || card.esid}:${audioUrl}`
  const cachedPeaks = waveformCache.get(cacheKey)
  if (cachedPeaks) {
    peaks.value = cachedPeaks
    hasError.value = false
    return
  }

  isLoading.value = true
  hasError.value = false

  try {
    const response = await fetch(audioUrl)
    if (!response.ok) {
      throw new Error(`Waveform fetch failed with status ${response.status}`)
    }

    const buffer = await response.arrayBuffer()
    const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) {
      throw new Error('AudioContext unavailable')
    }

    const context = new AudioContextClass()

    try {
      const decoded = await context.decodeAudioData(buffer.slice(0))
      const channelData = decoded.getChannelData(0)
      const computed = computePeaks(channelData, BAR_COUNT)
      peaks.value = computed
      waveformCache.set(cacheKey, computed)
    } finally {
      await context.close()
    }
  } catch (error) {
    console.warn('Mix waveform unavailable', error)
    hasError.value = true
    peaks.value = Array.from({ length: BAR_COUNT }, (_, index) => {
      return index % 6 === 0 ? 0.28 : 0.12
    })
  } finally {
    isLoading.value = false
  }
}

watch(
  () => props.card?.slug || '',
  async () => {
    await loadWaveform(props.card)
  },
  { immediate: true }
)

watch(safeCurrentTime, (current) => {
  if (!isScrubbing.value) {
    scrubValue.value = current
  }
}, { immediate: true })

const emitSeek = (value: number) => {
  const duration = safeDuration.value
  const clamped = Math.max(0, Math.min(value, duration))
  emit('seek', clamped)
}

const onSeekInput = (event: Event) => {
  const value = Number((event.target as HTMLInputElement).value)
  scrubValue.value = Number.isFinite(value) ? value : 0
  emitSeek(scrubValue.value)
}

const onSeekChange = (event: Event) => {
  const value = Number((event.target as HTMLInputElement).value)
  scrubValue.value = Number.isFinite(value) ? value : 0
  emitSeek(scrubValue.value)
}

const onScrubEnd = (event: Event) => {
  isScrubbing.value = false
  onSeekChange(event)
}

const seekFromPointer = (event: PointerEvent) => {
  const duration = safeDuration.value
  const svg = svgRef.value
  if (!svg || duration <= 0) {
    return
  }

  const rect = svg.getBoundingClientRect()
  if (rect.width <= 0) {
    return
  }

  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
  const nextTime = ratio * duration

  scrubValue.value = nextTime
  emitSeek(nextTime)
}

const onWavePointerDown = (event: PointerEvent) => {
  if (safeDuration.value <= 0) {
    return
  }

  isWaveDragging.value = true
  isScrubbing.value = true
  seekFromPointer(event)
}

const onWavePointerMove = (event: PointerEvent) => {
  if (!isWaveDragging.value) {
    return
  }

  seekFromPointer(event)
}

const onWavePointerUp = (event: PointerEvent) => {
  if (!isWaveDragging.value) {
    return
  }

  seekFromPointer(event)
  isWaveDragging.value = false
  isScrubbing.value = false
}
</script>

<style scoped lang="scss">
.mix-waveform {
  position: relative;
  height: 72px;
  border-radius: 12px;
  border: 1px solid hsl(var(--b3));
  background: linear-gradient(180deg, hsl(var(--b1)) 0%, hsl(var(--b2)) 100%);
  overflow: hidden;
  padding: 6px 8px 4px;
}

.mix-waveform__svg {
  width: 100%;
  height: 40px;
  display: block;
}

.mix-waveform__playhead {
  stroke: hsl(var(--bc));
  stroke-width: 0.9;
  vector-effect: non-scaling-stroke;
  filter: drop-shadow(0 0 3px hsl(var(--b1))) drop-shadow(0 0 6px hsl(var(--bc) / 0.35));
  pointer-events: none;
}

.mix-waveform__progress {
  fill: color-mix(in srgb, hsl(var(--bc)) 10%, transparent);
}

.mix-waveform__bar {
  fill: color-mix(in srgb, hsl(var(--bc)) 72%, transparent);
}

.mix-waveform__seek {
  margin-top: 2px;
}

.mix-waveform__time {
  margin-top: 1px;
  display: flex;
  justify-content: space-between;
  font-size: 0.64rem;
  color: hsl(var(--bc) / 0.65);
  line-height: 1;
}

.mix-waveform__status {
  position: absolute;
  right: 8px;
  bottom: 18px;
  font-size: 0.68rem;
  color: hsl(var(--bc) / 0.6);
}
</style>
