<template>
  <section class="mix-deck">
    <article v-if="card" :key="`card-${card.slug}`" class="mix-deck__cover" role="img" tabindex="-1"
      :aria-label="`${card.artist} - ${card.title}`">
      <img v-if="card.url_image" :src="card.url_image" alt="card cover" class="mix-deck__cover-image"
        draggable="false" />
      <div v-else class="mix-deck__cover-fallback">
        <p class="mix-deck__cover-title">{{ card.title }}</p>
        <p class="mix-deck__cover-artist">{{ card.artist }}</p>
      </div>
      <div v-if="isLoading" class="mix-deck__loading" aria-hidden="true" />
    </article>

    <Platine v-if="card && isPlatineMounted" :key="`platine-${card.slug}`" ref="platineRef" :card="card"
      :active="active" :delegate-replay-on-end="delegateReplayOnEnd" class="mix-deck__platine"
      :class="{ 'mix-deck__platine--visible': isOpen }" @loaded="onTrackLoaded" @finishPlaying="onFinishPlaying"
      @play-state-changed="onPlayStateChanged" @replay-requested="onReplayRequested" />
  </section>
</template>

<script setup lang="ts">
import type { Card } from '~~/types/types'
import Platine from '~/components/Platine.vue'

const props = defineProps<{
  card: Card | null
  label: 'A' | 'B'
  active: boolean
  delegateReplayOnEnd?: boolean
}>()

const emit = defineEmits<{
  ready: []
  'play-state-changed': [isPlaying: boolean]
  'replay-requested': []
}>()

const platineRef = ref<InstanceType<typeof Platine> | null>(null)
const { markCardFlipped, markCardPlayedToEnd } = usePersistentCardState()

const isOpen = ref(false)
const isLoading = ref(true)
const isPlatineMounted = ref(false)
const ready = ref(false)

const prepareVisualState = () => {
  isOpen.value = false
  isLoading.value = true
  isPlatineMounted.value = !!props.card
  ready.value = false
}

const onTrackLoaded = () => {
  isOpen.value = true
  isLoading.value = false
  ready.value = true
  emit('ready')
}

const waitUntilReady = (timeoutMs = 12000): Promise<boolean> => {
  if (ready.value) return Promise.resolve(true)

  return new Promise((resolve) => {
    const startedAt = Date.now()
    const timer = window.setInterval(() => {
      if (ready.value) {
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

const play = async (position = 0, withAcceleration = true) => {
  if (!platineRef.value) return false
  const started = await platineRef.value.play(position, withAcceleration)
  if (started && props.card?.slug) {
    markCardFlipped(props.card.slug)
  }

  return started
}

const onFinishPlaying = () => {
  if (!props.card?.slug) {
    return
  }

  markCardFlipped(props.card.slug)
  markCardPlayedToEnd(props.card.slug)
}

const onPlayStateChanged = (isPlaying: boolean) => {
  emit('play-state-changed', isPlaying)
}

const onReplayRequested = () => {
  emit('replay-requested')
}

const resume = async () => {
  const current = platineRef.value?.getCurrentTime?.() || 0
  if (!platineRef.value) return false
  return await platineRef.value.play(current)
}

const pause = () => {
  platineRef.value?.pause()
}

const unload = () => {
  platineRef.value?.unload?.()
  isOpen.value = false
  isLoading.value = true
  ready.value = false
}

const freezeBobineFor = (durationMs: number) => {
  platineRef.value?.freezeBobineFor?.(durationMs)
}

const setVolume = (volume: number) => {
  platineRef.value?.setVolume?.(volume)
}

const getRemainingTime = () => {
  return platineRef.value?.getRemainingTime?.() ?? Infinity
}

const jumpToNearEnd = async (secondsBeforeEnd = 5) => {
  if (!platineRef.value) return false
  return await platineRef.value.jumpToNearEnd?.(secondsBeforeEnd)
}

const togglePlay = async () => {
  if (!platineRef.value) {
    return false
  }

  const nextPlayingState = await platineRef.value.togglePlay?.()
  return Boolean(nextPlayingState)
}

watch(() => props.card, async () => {
  prepareVisualState()
  await nextTick()
})

defineExpose({
  waitUntilReady,
  play,
  resume,
  togglePlay,
  pause,
  freezeBobineFor,
  jumpToNearEnd,
  unload,
  setVolume,
  getRemainingTime,
})
</script>

<style scoped lang="scss">
.mix-deck {
  aspect-ratio: 1 / 1;
  position: relative;
  display: flex;
  align-items: stretch;
  justify-content: center;
}

.mix-deck__cover,
:deep(.platine) {
  position: absolute;
  width: 100%;
  height: 100%;
}

.mix-deck__cover {
  border-radius: 50%;
  overflow: hidden;
  padding: 6%;
  background-color: rgba(255, 255, 255, 0.5);
  box-sizing: border-box;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
}

.mix-deck__cover-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  border-radius: 50%;
}

.mix-deck__cover-fallback {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  overflow: hidden;
  padding: 10%;
  background: linear-gradient(145deg, #f6f6f6 0%, #e9e9e9 100%);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 0.5rem;
}

.mix-deck__cover-title,
.mix-deck__cover-artist {
  margin: 0;
  color: #1a1a1a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mix-deck__cover-title {
  font-size: 0.95rem;
  font-weight: 700;
}

.mix-deck__cover-artist {
  font-size: 0.85rem;
  opacity: 0.8;
}

.mix-deck__loading {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(circle at center, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.38));
}

.mix-deck__platine {
  width: 100%;
  height: 100%;
  opacity: 0;
  pointer-events: none;

  &--visible {
    opacity: 1;
    pointer-events: auto;
  }
}
</style>
