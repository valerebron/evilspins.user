<template>
  <div class="tarot-player" :class="{ loading: isLoadingTrack, playing: isPlaying }">
    <div class="meta">
      <div class="title">{{ props.card?.artist }} — {{ props.card?.title }}</div>
      <div class="hint" v-if="props.card?.start !== undefined">Segment start: {{ formatTime(props.card.start) }}</div>
    </div>

    <button class="play-toggle" type="button" @click="togglePlay" :disabled="isLoadingTrack">
      {{ isPlaying ? 'Pause' : 'Play' }}
    </button>

    <audio ref="audioRef" :src="props.card?.url_audio" preload="metadata" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import type { Card } from '~~/types/types'

const props = withDefaults(defineProps<{
  card?: Card
}>(), {
  card: undefined,
})

const emit = defineEmits(['loaded'])
const audioRef = ref<HTMLAudioElement | null>(null)
const isLoadingTrack = ref(true)
const isPlaying = ref(false)

const formatTime = (value: number) => {
  const totalSeconds = Math.max(0, Math.floor(value))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const setStartPosition = () => {
  const audio = audioRef.value
  if (!audio || props.card?.start === undefined) return

  const safeStart = Math.max(0, props.card.start)
  if (!Number.isNaN(safeStart) && audio.duration > safeStart) {
    audio.currentTime = safeStart
  }
}

const onLoadedMetadata = () => {
  setStartPosition()
  isLoadingTrack.value = false
  emit('loaded')
}

const onPlay = () => {
  isPlaying.value = true
}

const onPause = () => {
  isPlaying.value = false
}

const onEnded = () => {
  isPlaying.value = false
}

const loadAudio = async () => {
  if (!audioRef.value) return
  isLoadingTrack.value = true
  isPlaying.value = false
  audioRef.value.pause()
  audioRef.value.load()
}

const play = async () => {
  if (!audioRef.value) return
  setStartPosition()
  try {
    await audioRef.value.play()
  } catch (error) {
    console.warn('TarotPlayer: unable to play', error)
  }
}

const pause = () => {
  audioRef.value?.pause()
}

const togglePlay = async () => {
  if (!audioRef.value) return
  if (audioRef.value.paused) {
    await play()
  } else {
    pause()
  }
}

onMounted(async () => {
  const audio = audioRef.value
  if (!audio) return

  audio.addEventListener('loadedmetadata', onLoadedMetadata)
  audio.addEventListener('play', onPlay)
  audio.addEventListener('pause', onPause)
  audio.addEventListener('ended', onEnded)

  await nextTick()
  await loadAudio()
})

onUnmounted(() => {
  const audio = audioRef.value
  if (!audio) return
  audio.removeEventListener('loadedmetadata', onLoadedMetadata)
  audio.removeEventListener('play', onPlay)
  audio.removeEventListener('pause', onPause)
  audio.removeEventListener('ended', onEnded)
  pause()
})

watch(() => props.card, async (newCard, oldCard) => {
  if (!newCard || newCard === oldCard) return
  await nextTick()
  await loadAudio()
})

defineExpose({ play, pause, togglePlay })
</script>

<style scoped lang="scss">
.tarot-player {
  display: grid;
  gap: 1rem;
  align-items: center;
  justify-items: center;
  width: 100%;
  padding: 1.2rem;
  color: #fff;
  background: rgba(0, 0, 0, 0.35);
  border-radius: 1.6rem;
  text-align: center;

  .meta {
    display: grid;
    gap: 0.4rem;
  }

  .title {
    font-size: 1rem;
    font-weight: 700;
  }

  .hint {
    color: #d2d2d2;
    font-size: 0.85rem;
  }

  .play-toggle {
    padding: 0.85rem 1.2rem;
    border: none;
    border-radius: 999px;
    background: #f8e6b4;
    color: #1e1e1e;
    font-weight: 700;
    cursor: pointer;
    min-width: 10rem;
    transition: transform 0.15s ease;
  }

  .play-toggle:hover:not(:disabled) {
    transform: scale(1.02);
  }

  &.loading {
    opacity: 0.8;
  }
}
</style>
