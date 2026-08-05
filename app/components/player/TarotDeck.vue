<template>
  <main class="tarot-player" :class="{ 'tarot-player--embedded': props.embedded }">
    <section class="tarot-player__deck-stage">
      <div class="tarot-player__deck" :class="{ 'is-active': activeDeck === 'A' }" :aria-hidden="activeDeck !== 'A'">
        <MixDeckCard ref="deckARef" label="A" :card="deckA.card" :active="activeDeck === 'A'" delegate-replay-on-end
          @play-state-changed="(isPlaying) => onDeckPlayStateChanged('A', isPlaying)"
          @replay-requested="restartCompilation" />
      </div>

      <div class="tarot-player__deck" :class="{ 'is-active': activeDeck === 'B' }" :aria-hidden="activeDeck !== 'B'">
        <MixDeckCard ref="deckBRef" label="B" :card="deckB.card" :active="activeDeck === 'B'" delegate-replay-on-end
          @play-state-changed="(isPlaying) => onDeckPlayStateChanged('B', isPlaying)"
          @replay-requested="restartCompilation" />
      </div>
    </section>

    <div v-if="autoplayBlocked" class="tarot-player__autoplay">
      <button type="button" @click="resumePlayback">Lancer la lecture</button>
    </div>
  </main>
</template>

<script setup lang="ts">
import type { Card } from '~~/types/types'
import MixDeckCard from '~/components/MixDeckCard.vue'
import { timeout } from '~/utils/timeout'

const props = defineProps<{
  boxId: string
  startSlug?: string
  embedded?: boolean
}>()

const emit = defineEmits<{
  'track-started': [card: Card]
  'play-state-changed': [payload: { card: Card, isPlaying: boolean }]
}>()

const SWITCH_GUARD_SECONDS = 0.18
const TRACK_CHECK_INTERVAL_MS = 80
const DECK_CROSSFADE_MS = 1560

const boxStore = useBoxStore()
const { markCardPlayedToEnd } = usePersistentCardState()

const deckARef = ref<InstanceType<typeof MixDeckCard> | null>(null)
const deckBRef = ref<InstanceType<typeof MixDeckCard> | null>(null)

const deckA = reactive<{ card: Card | null }>({ card: null })
const deckB = reactive<{ card: Card | null }>({ card: null })
const deckAQueueIndex = ref<number | null>(null)
const deckBQueueIndex = ref<number | null>(null)

const activeDeck = ref<'A' | 'B'>('A')
const autoplayBlocked = ref(false)
const isTransitioning = ref(false)
const hasReachedQueueEnd = ref(false)
const cards = ref<Card[]>([])
const cursor = ref(0)
const deckCrossfadeDuration = `${DECK_CROSSFADE_MS}ms`

let monitorTimer: ReturnType<typeof window.setInterval> | null = null

const onKeyDown = async (event: KeyboardEvent) => {
  const target = event.target as HTMLElement | null
  const tagName = target?.tagName?.toLowerCase()
  if (tagName === 'input' || tagName === 'textarea' || target?.isContentEditable) {
    return
  }

  if (event.code === 'Space' || event.key === ' ') {
    event.preventDefault()
    await togglePlayback()
    return
  }

  if (event.key.toLowerCase() !== 'n') {
    return
  }

  event.preventDefault()
  const activeRef = getDeckRef(activeDeck.value)
  if (!activeRef) return

  await activeRef.jumpToNearEnd?.(5)
}

const requestedSide = computed<'A' | 'B'>(() => props.boxId.endsWith('B') ? 'B' : 'A')
const baseBoxId = computed(() => props.boxId.replace(/[AB]$/, ''))

const getDeckRef = (deck: 'A' | 'B') => deck === 'A' ? deckARef.value : deckBRef.value

const getDeckQueueIndex = (deck: 'A' | 'B') => deck === 'A' ? deckAQueueIndex.value : deckBQueueIndex.value

const setDeckQueueIndex = (deck: 'A' | 'B', index: number | null) => {
  if (deck === 'A') {
    deckAQueueIndex.value = index
    return
  }

  deckBQueueIndex.value = index
}

const getInactiveDeck = () => activeDeck.value === 'A' ? 'B' : 'A'

const onDeckPlayStateChanged = (deck: 'A' | 'B', isPlaying: boolean) => {
  if (activeDeck.value !== deck) {
    return
  }

  const card = deck === 'A' ? deckA.card : deckB.card
  if (!card) {
    return
  }

  emit('play-state-changed', { card, isPlaying })
}

const resolveBoxCards = async () => {
  const box = await boxStore.fetchBoxById(baseBoxId.value, true)
  if (!box) {
    cards.value = []
    cursor.value = 0
    return
  }

  const preferredSide = requestedSide.value
  const sideCards = box.cards
    .filter(card => (card.box_side || '').toUpperCase() === preferredSide)
    .sort((left, right) => {
      const leftPosition = Number.isFinite(left.box_position) ? Number(left.box_position) : Number.MAX_SAFE_INTEGER
      const rightPosition = Number.isFinite(right.box_position) ? Number(right.box_position) : Number.MAX_SAFE_INTEGER
      return leftPosition - rightPosition
    })

  const orderedCards = sideCards.length > 0
    ? sideCards
    : [...box.cards].sort((left, right) => {
      const leftPosition = Number.isFinite(left.box_position) ? Number(left.box_position) : Number.MAX_SAFE_INTEGER
      const rightPosition = Number.isFinite(right.box_position) ? Number(right.box_position) : Number.MAX_SAFE_INTEGER
      return leftPosition - rightPosition
    })

  const startSlug = props.startSlug || ''
  if (!startSlug) {
    cards.value = orderedCards
    cursor.value = 0
    return
  }

  const startIndex = orderedCards.findIndex(card => card.slug === startSlug)
  if (startIndex <= 0) {
    cards.value = orderedCards
    cursor.value = 0
    return
  }

  cards.value = orderedCards
  cursor.value = startIndex
}

const takeNextCard = () => {
  if (cards.value.length === 0 || cursor.value >= cards.value.length) {
    return null
  }

  const card = cards.value[cursor.value]
  cursor.value += 1
  return card
}

const waitUntilReady = async (deck: 'A' | 'B') => {
  const refInstance = getDeckRef(deck)
  if (!refInstance) return false
  return await refInstance.waitUntilReady()
}

const loadDeckTrack = async (deck: 'A' | 'B') => {
  const nextIndex = cursor.value
  const nextCard = takeNextCard()
  if (!nextCard) {
    hasReachedQueueEnd.value = true
    if (deck === 'A') {
      deckA.card = null
    } else {
      deckB.card = null
    }
    setDeckQueueIndex(deck, null)
    return false
  }

  hasReachedQueueEnd.value = false
  setDeckQueueIndex(deck, nextIndex)

  if (deck === 'A') {
    deckA.card = nextCard
  } else {
    deckB.card = nextCard
  }

  await nextTick()
  return await waitUntilReady(deck)
}

const prepareInitialDecks = async () => {
  await Promise.all([
    loadDeckTrack('A'),
    loadDeckTrack('B'),
  ])
}

const startPlayback = async () => {
  activeDeck.value = 'A'
  const didPlay = await deckARef.value?.play(0)
  autoplayBlocked.value = !didPlay
  if (didPlay && deckA.card) {
    emit('track-started', deckA.card)
    emit('play-state-changed', { card: deckA.card, isPlaying: true })
  }
}

const switchDeck = async () => {
  if (isTransitioning.value) return

  const fromDeck = activeDeck.value
  const toDeck = getInactiveDeck()
  const fromRef = getDeckRef(fromDeck)
  const toRef = getDeckRef(toDeck)

  if (!fromRef || !toRef) return

  isTransitioning.value = true

  const fromQueueIndex = getDeckQueueIndex(fromDeck)
  const toQueueIndex = getDeckQueueIndex(toDeck)
  if (toQueueIndex === null || (fromQueueIndex !== null && toQueueIndex <= fromQueueIndex)) {
    hasReachedQueueEnd.value = true
    isTransitioning.value = false
    return
  }

  const toReady = await waitUntilReady(toDeck)
  if (!toReady) {
    const loaded = await loadDeckTrack(toDeck)
    if (!loaded) {
      hasReachedQueueEnd.value = true
      isTransitioning.value = false
      return
    }
  }

  const canStartIncoming = await toRef.play(0, false)
  if (!canStartIncoming) {
    autoplayBlocked.value = true
    isTransitioning.value = false
    return
  }

  const incomingCard = toDeck === 'A' ? deckA.card : deckB.card
  if (incomingCard) {
    emit('track-started', incomingCard)
    emit('play-state-changed', { card: incomingCard, isPlaying: true })
  }

  // No crossfader: switch source directly once incoming deck starts.
  activeDeck.value = toDeck

  const outgoingCard = fromDeck === 'A' ? deckA.card : deckB.card
  if (outgoingCard?.slug) {
    markCardPlayedToEnd(outgoingCard.slug)
  }
  fromRef.freezeBobineFor?.(DECK_CROSSFADE_MS)
  fromRef.unload()

  await timeout(DECK_CROSSFADE_MS)
  await loadDeckTrack(fromDeck)

  isTransitioning.value = false
}

const monitorRemainingTime = () => {
  if (monitorTimer) {
    window.clearInterval(monitorTimer)
  }

  monitorTimer = window.setInterval(async () => {
    if (isTransitioning.value || autoplayBlocked.value || hasReachedQueueEnd.value) return

    const activeRef = getDeckRef(activeDeck.value)
    if (!activeRef) return

    const remaining = activeRef.getRemainingTime()
    if (!Number.isFinite(remaining)) return

    if (remaining <= SWITCH_GUARD_SECONDS) {
      await switchDeck()
    }
  }, TRACK_CHECK_INTERVAL_MS)
}

const resumePlayback = async () => {
  const activeRef = getDeckRef(activeDeck.value)
  if (!activeRef) return

  const didPlay = await activeRef.resume()
  autoplayBlocked.value = !didPlay
  if (didPlay) {
    const activeCard = activeDeck.value === 'A' ? deckA.card : deckB.card
    if (activeCard) {
      emit('track-started', activeCard)
      emit('play-state-changed', { card: activeCard, isPlaying: true })
    }
  }
}

const togglePlayback = async () => {
  if (autoplayBlocked.value) {
    await resumePlayback()
    return true
  }

  const activeRef = getDeckRef(activeDeck.value)
  if (!activeRef) {
    return false
  }

  const isPlaying = await activeRef.togglePlay?.()
  const activeCard = activeDeck.value === 'A' ? deckA.card : deckB.card
  if (activeCard && typeof isPlaying === 'boolean') {
    emit('play-state-changed', { card: activeCard, isPlaying })
  }

  return Boolean(isPlaying)
}

const restartCompilation = async () => {
  if (isTransitioning.value || cards.value.length === 0) {
    return
  }

  isTransitioning.value = true
  autoplayBlocked.value = false
  hasReachedQueueEnd.value = false

  deckARef.value?.pause()
  deckBRef.value?.pause()

  deckA.card = null
  deckB.card = null
  setDeckQueueIndex('A', null)
  setDeckQueueIndex('B', null)
  cursor.value = 0

  await nextTick()
  await prepareInitialDecks()
  await startPlayback()

  isTransitioning.value = false
}

onMounted(async () => {
  window.addEventListener('keydown', onKeyDown)
  await resolveBoxCards()
  await prepareInitialDecks()
  await startPlayback()
  monitorRemainingTime()
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)

  if (monitorTimer) {
    window.clearInterval(monitorTimer)
  }

  deckARef.value?.pause()
  deckBRef.value?.pause()
})

defineExpose({
  togglePlayback,
})
</script>

<style scoped lang="scss">
.tarot-player {
  width: 100%;
  height: 100svh;
  display: grid;
  place-items: center;
  position: relative;
  padding: 12px;
}

.tarot-player--embedded {
  height: 100%;
  padding: 0;
}

.tarot-player__deck-stage {
  width: min(94svw, 94svh);
  height: min(94svw, 94svh);
  position: relative;
  isolation: isolate;
}

.tarot-player__deck {
  position: absolute;
  inset: 0;
  opacity: 0;
  z-index: 1;
  transition: opacity v-bind(deckCrossfadeDuration) ease;
  will-change: opacity;
  pointer-events: none;

  &.is-active {
    opacity: 1;
    z-index: 2;
    pointer-events: auto;
  }
}

.tarot-player__autoplay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.82);

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
</style>