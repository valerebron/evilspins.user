<template>
  <main class="tarot-player" :class="{ 'tarot-player--embedded': props.embedded }">
    <section class="tarot-player__deck-stage">
      <div class="tarot-player__deck" :class="{ 'is-active': activeDeck === 'A' }" v-show="activeDeck === 'A'">
        <MixDeckCard ref="deckARef" label="A" :card="deckA.card" :active="activeDeck === 'A'"
          @play-state-changed="(isPlaying) => onDeckPlayStateChanged('A', isPlaying)" />
      </div>

      <div class="tarot-player__deck" :class="{ 'is-active': activeDeck === 'B' }" v-show="activeDeck === 'B'">
        <MixDeckCard ref="deckBRef" label="B" :card="deckB.card" :active="activeDeck === 'B'"
          @play-state-changed="(isPlaying) => onDeckPlayStateChanged('B', isPlaying)" />
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

const boxStore = useBoxStore()
const { markCardPlayedToEnd } = usePersistentCardState()

const deckARef = ref<InstanceType<typeof MixDeckCard> | null>(null)
const deckBRef = ref<InstanceType<typeof MixDeckCard> | null>(null)

const deckA = reactive<{ card: Card | null }>({ card: null })
const deckB = reactive<{ card: Card | null }>({ card: null })

const activeDeck = ref<'A' | 'B'>('A')
const autoplayBlocked = ref(false)
const isTransitioning = ref(false)
const cards = ref<Card[]>([])
const cursor = ref(0)

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

  cards.value = [
    ...orderedCards.slice(startIndex),
    ...orderedCards.slice(0, startIndex),
  ]
  cursor.value = 0
}

const takeNextCard = () => {
  if (cards.value.length === 0) {
    return null
  }

  const card = cards.value[cursor.value % cards.value.length]
  cursor.value = (cursor.value + 1) % cards.value.length
  return card
}

const waitUntilReady = async (deck: 'A' | 'B') => {
  const refInstance = getDeckRef(deck)
  if (!refInstance) return false
  return await refInstance.waitUntilReady()
}

const loadDeckTrack = async (deck: 'A' | 'B') => {
  const nextCard = takeNextCard()
  if (!nextCard) return false

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

  const toReady = await waitUntilReady(toDeck)
  if (!toReady) {
    const loaded = await loadDeckTrack(toDeck)
    if (!loaded) {
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
  const outgoingCard = fromDeck === 'A' ? deckA.card : deckB.card
  if (outgoingCard?.slug) {
    markCardPlayedToEnd(outgoingCard.slug)
  }
  fromRef.unload()
  activeDeck.value = toDeck

  await loadDeckTrack(fromDeck)

  isTransitioning.value = false
}

const monitorRemainingTime = () => {
  if (monitorTimer) {
    window.clearInterval(monitorTimer)
  }

  monitorTimer = window.setInterval(async () => {
    if (isTransitioning.value || autoplayBlocked.value) return

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
  overflow: hidden;
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
}

.tarot-player__deck {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 260ms ease;
  pointer-events: none;

  &.is-active {
    opacity: 1;
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