<template>
  <section class="turntable" :class="{ 'turntable--active': active }">
    <header class="turntable__header">
      <p class="turntable__label">Platine {{ label }}</p>
      <p class="turntable__status">{{ isPlaying ? 'Lecture' : (isReady ? 'Prête' : 'Chargement') }}</p>
    </header>

    <div class="turntable__track">
      <p class="turntable__title">{{ card?.title || 'Morceau en attente' }}</p>
      <p class="turntable__artist">{{ card?.artist || 'Chargement de la file...' }}</p>
    </div>

    <div class="turntable__meter" :style="{ '--progress': `${progressPercent}%` }">
      <div class="turntable__meter-fill" />
    </div>

    <audio ref="audioRef" preload="auto" @loadedmetadata="onLoadedMetadata" @canplay="onCanPlay"
      @timeupdate="onTimeUpdate" @play="onPlay" @pause="onPause" @ended="onEnded" @error="onError" />
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { Card } from '~~/types/types'

const props = defineProps<{
  label: 'A' | 'B'
  card?: Card | null
  volume: number
  active: boolean
}>()

const emit = defineEmits<{
  loaded: []
  ended: []
  playstate: [isPlaying: boolean]
}>()

const audioRef = ref<HTMLAudioElement | null>(null)
const { resolveMediaUrl } = useMediaUrl()
const isReady = ref(false)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)

const progressPercent = computed(() => {
  if (!duration.value) return 0
  return Math.max(0, Math.min(100, (currentTime.value / duration.value) * 100))
})

const clampVolume = (value: number) => Math.max(0, Math.min(1, value))

const applyVolume = (value: number) => {
  if (!audioRef.value) return
  audioRef.value.volume = clampVolume(value)
}

const setSourceFromCard = async () => {
  const audio = audioRef.value
  if (!audio) return

  isReady.value = false
  isPlaying.value = false
  currentTime.value = 0
  duration.value = 0

  audio.pause()
  audio.removeAttribute('src')

  if (!props.card?.url_audio) {
    audio.load()
    return
  }

  audio.src = resolveMediaUrl(props.card.url_audio)
  audio.load()
  await nextTick()
}

const play = async (startAt?: number): Promise<boolean> => {
  const audio = audioRef.value
  if (!audio || !props.card) return false

  if (typeof startAt === 'number' && Number.isFinite(startAt) && startAt >= 0) {
    audio.currentTime = startAt
  }

  try {
    await audio.play()
    return true
  } catch (error) {
    console.warn('TurntablePlayer: play blocked or failed', error)
    return false
  }
}

const pause = () => {
  audioRef.value?.pause()
}

const unload = () => {
  const audio = audioRef.value
  if (!audio) return
  audio.pause()
  audio.removeAttribute('src')
  audio.load()
  isReady.value = false
  isPlaying.value = false
  currentTime.value = 0
  duration.value = 0
}

const waitUntilReady = (timeoutMs = 12000): Promise<boolean> => {
  if (isReady.value) return Promise.resolve(true)

  return new Promise((resolve) => {
    const startedAt = Date.now()
    const timer = window.setInterval(() => {
      if (isReady.value) {
        window.clearInterval(timer)
        resolve(true)
        return
      }

      if (Date.now() - startedAt > timeoutMs) {
        window.clearInterval(timer)
        resolve(false)
      }
    }, 100)
  })
}

const getRemainingTime = () => {
  if (!audioRef.value || !duration.value) return Infinity
  return Math.max(0, duration.value - audioRef.value.currentTime)
}

const onLoadedMetadata = () => {
  duration.value = Number.isFinite(audioRef.value?.duration) ? (audioRef.value?.duration || 0) : 0
}

const onCanPlay = () => {
  isReady.value = true
  emit('loaded')
}

const onTimeUpdate = () => {
  if (!audioRef.value) return
  currentTime.value = audioRef.value.currentTime
}

const onPlay = () => {
  isPlaying.value = true
  emit('playstate', true)
}

const onPause = () => {
  isPlaying.value = false
  emit('playstate', false)
}

const onEnded = () => {
  isPlaying.value = false
  currentTime.value = duration.value
  emit('ended')
}

const onError = () => {
  isReady.value = false
}

watch(() => props.volume, (volume) => {
  applyVolume(volume)
}, { immediate: true })

watch(() => props.card?.url_audio, async () => {
  await setSourceFromCard()
})

defineExpose({
  play,
  pause,
  unload,
  waitUntilReady,
  getRemainingTime,
  isReady,
  isPlaying,
  applyVolume,
})
</script>

<style scoped lang="scss">
.turntable {
  width: 100%;
  height: 100%;
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  background: linear-gradient(180deg, #f5f5f3 0%, #ece8e0 100%);
  padding: 14px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 12px;
  overflow: hidden;

  &--active {
    border-color: #111;
    box-shadow: 0 0 0 1px #111 inset;
  }
}

.turntable__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.turntable__label {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.turntable__status {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 600;
}

.turntable__track {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 70px;
}

.turntable__title {
  margin: 0;
  font-size: 1.02rem;
  font-weight: 700;
  line-height: 1.25;
}

.turntable__artist {
  margin: 0;
  font-size: 0.9rem;
  opacity: 0.8;
}

.turntable__meter {
  --progress: 0%;
  width: 100%;
  height: 9px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.18);
  overflow: hidden;
}

.turntable__meter-fill {
  width: var(--progress);
  height: 100%;
  background: #111;
  transition: width 0.1s linear;
}
</style>