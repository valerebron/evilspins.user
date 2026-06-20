<template>
  <main class="mix-page">
    <div class="mix-page__fader-glow" :style="faderGlowStyle" aria-hidden="true" />
    <section class="mix-page__decks">
      <div class="mix-page__deck-slot">
        <MixDeckCard ref="deckARef" label="A" :card="deckA.card" :active="activeDeck === 'A'" />
      </div>

      <div class="mix-page__deck-slot">
        <MixDeckCard ref="deckBRef" label="B" :card="deckB.card" :active="activeDeck === 'B'" />
      </div>
    </section>

    <aside class="mix-page__fader-wrap">
      <Crossfader :model-value="crossfader" :orientation="isPortraitLayout ? 'vertical' : 'horizontal'"
        @update:model-value="onUserCrossfaderInput" @interaction-start="onFaderInteractionStart"
        @interaction-end="onFaderInteractionEnd" />
    </aside>

    <div v-if="autoplayBlocked" class="mix-page__autoplay">
      <button type="button" @click="resumePlayback">Lancer le Mix</button>
    </div>
  </main>
</template>

<script setup lang="ts">
import type { Card } from '~~/types/types'
import MixDeckCard from '~/components/MixDeckCard.vue'

definePageMeta({
  inMenu: true,
})

useHead({
  bodyAttrs: {
    class: 'mix-page-body',
  },
})

const AUTO_CROSSFADE_SECONDS = 15
const USER_PRIORITY_MS = 1600

const deckARef = ref<InstanceType<typeof MixDeckCard> | null>(null)
const deckBRef = ref<InstanceType<typeof MixDeckCard> | null>(null)

const deckA = reactive<{ card: Card | null }>({ card: null })
const deckB = reactive<{ card: Card | null }>({ card: null })

const activeDeck = ref<'A' | 'B'>('A')
const crossfader = ref(0)
const isTransitioning = ref(false)
const autoplayBlocked = ref(false)
const isPortraitLayout = ref(false)
const isUserInteractingFader = ref(false)

const faderGlowStyle = computed(() => {
  const percent = Math.max(0, Math.min(1, crossfader.value)) * 100

  if (isPortraitLayout.value) {
    return {
      background: 'rgba(255, 215, 0, 1)',
      top: `${percent}%`,
      left: '0',
      right: '0',
      height: '100svh',
      width: '100%',
      transform: 'translateY(-50%)',
    }
  }

  return {
    background: 'rgba(255, 215, 0, 1)',
    left: `${percent}%`,
    top: '0',
    bottom: '0',
    width: '100svw',
    height: '100svh',
    transform: 'translateX(-50%)',
  }
})

const queue = ref<Card[]>([])

let monitorTimer: ReturnType<typeof window.setInterval> | null = null
let fadeRafId: number | null = null
let userOverrideUntil = 0

const canAutoControlFader = () => {
  return !isUserInteractingFader.value && performance.now() >= userOverrideUntil
}

const applyCrossfader = (value: number) => {
  const clamped = Math.max(0, Math.min(1, value))
  crossfader.value = clamped

  // Courbe de crossfader demandée:
  // - centre (0.5): A=100%, B=100%
  // - full A (0): A=100%, B=0%
  // - full B (1): A=0%, B=100%
  const volumeA = clamped <= 0.5 ? 1 : Math.max(0, (1 - clamped) * 2)
  const volumeB = clamped >= 0.5 ? 1 : Math.max(0, clamped * 2)

  deckARef.value?.setVolume(volumeA)
  deckBRef.value?.setVolume(volumeB)
}

const getDeckRef = (deck: 'A' | 'B') => {
  return deck === 'A' ? deckARef.value : deckBRef.value
}

const getInactiveDeck = () => {
  return activeDeck.value === 'A' ? 'B' : 'A'
}

const fetchRandomCard = async () => {
  return await $fetch<Card>('/api/card/random')
}

const fillQueue = async (minSize = 3) => {
  while (queue.value.length < minSize) {
    const card = await fetchRandomCard()
    queue.value.push(card)
  }
}

const takeNextCard = async () => {
  await fillQueue(1)
  const next = queue.value.shift()
  if (!next) return null
  void fillQueue(3)
  return next
}

const waitForReady = async (deck: 'A' | 'B') => {
  const refInstance = getDeckRef(deck)
  if (!refInstance) return false
  return await refInstance.waitUntilReady()
}

const loadDeckTrack = async (deck: 'A' | 'B') => {
  const nextCard = await takeNextCard()
  if (!nextCard) return false

  if (deck === 'A') {
    deckA.card = nextCard
  } else {
    deckB.card = nextCard
  }

  await nextTick()
  const isReady = await waitForReady(deck)
  applyCrossfader(crossfader.value)
  return isReady
}

const prepareInitialTracks = async () => {
  await fillQueue(2)
  await Promise.all([
    loadDeckTrack('A'),
    loadDeckTrack('B'),
  ])
}

const startInitialPlayback = async () => {
  applyCrossfader(0)
  activeDeck.value = 'A'

  const didPlay = await deckARef.value?.play(0)
  autoplayBlocked.value = !didPlay
}

const finalizeTransition = async (fromDeck: 'A' | 'B', toDeck: 'A' | 'B') => {
  const fromRef = getDeckRef(fromDeck)
  fromRef?.pause()
  fromRef?.unload?.()

  activeDeck.value = toDeck

  await loadDeckTrack(fromDeck)
  if (canAutoControlFader()) {
    applyCrossfader(toDeck === 'A' ? 0 : 1)
  }
}

const animateCrossfade = async (targetDeck: 'A' | 'B') => {
  const targetValue = targetDeck === 'A' ? 0 : 1
  const initialValue = crossfader.value
  const startedAt = performance.now()
  const durationMs = AUTO_CROSSFADE_SECONDS * 1000

  await new Promise<void>((resolve) => {
    const frame = (timestamp: number) => {
      const elapsed = timestamp - startedAt
      const progress = Math.max(0, Math.min(1, elapsed / durationMs))
      const value = initialValue + ((targetValue - initialValue) * progress)
      if (canAutoControlFader()) {
        applyCrossfader(value)
      }

      if (progress >= 1) {
        fadeRafId = null
        resolve()
        return
      }

      fadeRafId = requestAnimationFrame(frame)
    }

    fadeRafId = requestAnimationFrame(frame)
  })
}

const triggerTransition = async () => {
  if (isTransitioning.value) return

  const fromDeck = activeDeck.value
  const toDeck = getInactiveDeck()
  const toRef = getDeckRef(toDeck)

  if (!toRef) return

  isTransitioning.value = true

  const isReady = await waitForReady(toDeck)
  if (!isReady) {
    await loadDeckTrack(toDeck)
  }

  const canStartIncoming = await toRef.play(0)
  if (!canStartIncoming) {
    isTransitioning.value = false
    autoplayBlocked.value = true
    return
  }

  await animateCrossfade(toDeck)
  await finalizeTransition(fromDeck, toDeck)

  isTransitioning.value = false
}

const monitorTrackEnd = () => {
  if (monitorTimer) {
    window.clearInterval(monitorTimer)
  }

  monitorTimer = window.setInterval(async () => {
    if (isTransitioning.value || autoplayBlocked.value) return

    const activeRef = getDeckRef(activeDeck.value)
    if (!activeRef) return

    const remaining = activeRef.getRemainingTime()
    if (!Number.isFinite(remaining)) return

    if (remaining <= AUTO_CROSSFADE_SECONDS) {
      await triggerTransition()
    }
  }, 200)
}

const updateLayoutMode = () => {
  isPortraitLayout.value = window.innerHeight > window.innerWidth
}

const resumePlayback = async () => {
  const currentRef = getDeckRef(activeDeck.value)
  if (!currentRef) return

  const didPlay = await currentRef.resume()
  autoplayBlocked.value = !didPlay
}

const onUserCrossfaderInput = (value: number) => {
  userOverrideUntil = performance.now() + USER_PRIORITY_MS
  applyCrossfader(value)
}

const onFaderInteractionStart = () => {
  isUserInteractingFader.value = true
  userOverrideUntil = performance.now() + USER_PRIORITY_MS
}

const onFaderInteractionEnd = () => {
  isUserInteractingFader.value = false
  userOverrideUntil = performance.now() + USER_PRIORITY_MS
}

onMounted(async () => {
  updateLayoutMode()
  window.addEventListener('resize', updateLayoutMode)

  await prepareInitialTracks()
  await startInitialPlayback()
  monitorTrackEnd()
})

onUnmounted(() => {
  if (monitorTimer) {
    window.clearInterval(monitorTimer)
  }

  if (fadeRafId !== null) {
    cancelAnimationFrame(fadeRafId)
  }

  window.removeEventListener('resize', updateLayoutMode)

  deckARef.value?.pause()
  deckBRef.value?.pause()
})
</script>

<style scoped lang="scss">
:global(body.mix-page-body) {
  overflow: hidden;
}

.mix-page {
  width: 100%;
  height: 100svh;
  max-height: 100svh;
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: 1fr auto;
  gap: 12px;
  padding: 12px;
  overflow: hidden;
  position: relative;
}

.mix-page__fader-glow {
  position: absolute;
  pointer-events: none;
  z-index: 0;
  filter: blur(0px);
  opacity: 1;
}

.mix-page__decks {
  position: relative;
  z-index: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 10px;
  overflow: hidden;
}

.mix-page__deck-slot {
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
  container-type: size;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.mix-page__fader-wrap {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 3;
  background: rgba(255, 255, 255, 0.88);
  border-radius: 14px;
  padding: 10px 6px;
  margin: 10px;
}

.mix-page__autoplay {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.8);

  button {
    border: 1px solid #111;
    border-radius: 10px;
    background: #111;
    color: #fff;
    font-weight: 600;
    padding: 10px 14px;
    cursor: pointer;
  }
}

@media (orientation: landscape) {
  .mix-page {
    grid-template-rows: 1fr auto;
    padding: 18px;
    gap: 18px;
  }

  .mix-page__decks {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr;
    gap: 18px;
  }

  .mix-page__fader-wrap {
    position: static;
    transform: none;
    justify-self: center;
    align-self: start;
    margin-top: -100px;
    background: transparent;
    border: 0;
    padding: 0;
  }
}
</style>