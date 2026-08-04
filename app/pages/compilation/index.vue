<template>
  <main class="mix-page" :class="{ 'mix-page--playing': isPlaybackOpen }">
    <header v-if="playbackBox" class="mix-current-box">
      <h1>{{ playbackBox.name }}</h1>
    </header>

    <section v-if="renderedBoxes.length" ref="shelfRef" class="mix-shelf"
      :class="{ 'mix-shelf--has-active': Boolean(selectedBoxId) }">
      <div v-for="(item, index) in renderedBoxes" :key="item.id" :ref="(el) => setBoxItemRef(item.id, el)"
        class="mix-shelf__item" :class="{ 'mix-shelf__item--active': selectedBoxId === item.id }"
        :style="getBoxItemStyle(item.id)">
        <Box :box="item" :is-selected="selectedBoxId === item.id" :mode-rotations="rotations"
          :disableInteraction="false" @toggle-select="(face) => toggleBoxSelection(item.id, face)"
          @face-changed="(face) => syncSelectedFace(item.id, face)" :tabindex="index" />

        <Transition name="mix-shelf-details">
          <section v-if="detailsVisibleBoxId === item.id && selectedBoxQuote" class="mix-shelf__details">
            <PlayButton class="mix-shelf__play" interactive :is-playing="isSelectedBoxPlaying"
              :aria-label="`Lire ${item.name}`" @click.stop="openSelectedBoxPlayback" />

            <blockquote class="mix-shelf__quote">
              <p>
                <span v-for="(line, lineIndex) in selectedBoxQuote.lines" :key="`${item.id}:${lineIndex}`"
                  class="mix-shelf__quote-line">
                  {{ line }}
                </span>
              </p>
              <footer v-if="selectedBoxQuote.author">{{ selectedBoxQuote.author }}</footer>
            </blockquote>
          </section>
        </Transition>
      </div>
    </section>

    <section v-if="isPlaybackOpen" ref="playbackRef" class="mix-playback">
      <div class="mix-playback__deck-wrap">
        <TarotDeck :key="playbackDeckKey" :box-id="playbackBoxIdWithFace" :start-slug="playbackStartSlug || undefined"
          ref="tarotDeckRef" embedded @track-started="handleTrackStarted"
          @play-state-changed="handlePlaybackStateChanged" />
      </div>

      <ul class="mix-playback__cards" aria-label="Cartes de la box en lecture">
        <li v-for="card in playbackCards" :key="card.esid" class="mix-playback__card-item"
          :data-card-slug="card.slug || ''">
          <Card :card="card" :is-face-up="isCardAlreadyRead(card)" :back-color="playbackFaceColor"
            :is-current="playbackStartSlug === (card.slug || '')" :show-play-button="false"
            :is-playing="isCurrentlyPlayingCard(card)" :disabled="!isCardAlreadyRead(card)"
            click-behavior="external-player" @play-request="queuePlaybackFromCard" />
        </li>
      </ul>
    </section>
  </main>
</template>

<script setup lang="ts">
import type { Card as CardType } from '~~/types/types'
import type { BoxDetails } from '~~/types/types'
import type { ComponentPublicInstance } from 'vue'
import TarotDeck from '~/components/player/TarotDeck.vue'
import PlayButton from '~/components/UI/PlayButton.vue'

type BoxMode = 'stored' | 'selected'
type Rotation = {
  x: number
  y: number
  z: number
}

const boxStore = useBoxStore()
const route = useRoute()
const selectedBoxId = ref<string | null>(null)
const selectedBoxFace = ref<'A' | 'B'>('A')
const shelfRef = ref<HTMLElement | null>(null)
const playbackRef = ref<HTMLElement | null>(null)
const tarotDeckRef = ref<InstanceType<typeof TarotDeck> | null>(null)
const boxItemRefs = ref<Record<string, HTMLElement | null>>({})
const elevatedBoxIds = ref<Record<string, boolean>>({})
const playbackBoxId = ref<string | null>(null)
const playbackBoxFace = ref<'A' | 'B'>('A')
const playbackStartSlug = ref<string | null>(null)
const playbackIsPlaying = ref(false)
const selectedBoxMoveX = ref<Record<string, number>>({})
const detailsVisibleBoxId = ref<string | null>(null)
const { ensureLoaded, stateBySlug } = usePersistentCardState()
const routeSyncReady = ref(false)
const BOX_Z_INDEX_OPEN_DELAY_MS = 100
const BOX_Z_INDEX_CLOSE_DELAY_MS = 570
const BOX_DETAILS_REVEAL_DELAY_MS = 1000
const boxElevationTimers: Record<string, ReturnType<typeof setTimeout> | null> = {}
let detailsRevealTimer: ReturnType<typeof setTimeout> | null = null

const routeBoxId = computed(() => {
  const id = route.params.id
  if (typeof id === 'string') {
    return id
  }
  if (Array.isArray(id)) {
    return id[0] || ''
  }

  return ''
})

const rotations = ref<Record<BoxMode, Rotation>>({
  stored: { x: -18, y: -1, z: 90 },
  selected: { x: 29, y: 18, z: 88 },
})

const isPlaybackOpen = computed(() => !!playbackBoxId.value)
const playbackBox = computed(() => {
  if (!playbackBoxId.value) return null
  return boxStore.boxById[playbackBoxId.value] || null
})
const playbackBoxIdWithFace = computed(() => {
  if (!playbackBoxId.value) return ''
  return `${playbackBoxId.value}${playbackBoxFace.value}`
})
const playbackDeckKey = computed(() => {
  return `${playbackBoxIdWithFace.value}:${playbackStartSlug.value || 'head'}`
})
const playbackCards = computed<CardType[]>(() => {
  const cards = playbackBox.value?.cards ?? []
  const side = playbackBoxFace.value

  const sideCards = cards.filter(card => (card.box_side || '').toUpperCase() === side)
  const source = sideCards.length > 0 ? sideCards : cards

  return [...source].sort((left, right) => {
    const leftPosition = Number.isFinite(left.box_position) ? Number(left.box_position) : Number.MAX_SAFE_INTEGER
    const rightPosition = Number.isFinite(right.box_position) ? Number(right.box_position) : Number.MAX_SAFE_INTEGER
    return leftPosition - rightPosition
  })
})

const playbackFaceColor = computed(() => {
  return playbackBox.value?.color?.[playbackBoxFace.value] || null
})

const selectedBoxQuote = computed(() => {
  if (!selectedBoxId.value) {
    return null
  }

  const box = boxStore.boxById[selectedBoxId.value]
  const quoteSide = box?.quote?.[selectedBoxFace.value]
  if (!quoteSide) {
    return null
  }

  const lines = Object.entries(quoteSide)
    .filter(([key, value]) => key !== 'author' && key !== 'auhor' && typeof value === 'string' && value.trim().length > 0)
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([, value]) => value as string)

  const author = quoteSide.author || quoteSide.auhor || ''
  if (!lines.length && !author) {
    return null
  }

  return {
    lines,
    author,
  }
})

const isSelectedBoxPlaying = computed(() => {
  return playbackIsPlaying.value
    && playbackBoxId.value === selectedBoxId.value
    && playbackBoxFace.value === selectedBoxFace.value
})

const setBoxItemRef = (boxId: string, element: Element | ComponentPublicInstance | null) => {
  const resolvedElement = element instanceof HTMLElement
    ? element
    : element && '$el' in element && element.$el instanceof HTMLElement
      ? element.$el
      : null

  boxItemRefs.value[boxId] = resolvedElement
}

const getBoxItemStyle = (boxId: string) => {
  const moveX = selectedBoxMoveX.value[boxId] || 0
  const zIndex = elevatedBoxIds.value[boxId] ? 10 : 1

  return {
    '--move-x': `${moveX}px`,
    '--item-z-index': `${zIndex}`,
  }
}

const clearBoxElevationTimer = (boxId: string) => {
  const timer = boxElevationTimers[boxId]
  if (!timer) {
    return
  }

  clearTimeout(timer)
  boxElevationTimers[boxId] = null
}

const setBoxElevation = (boxId: string, isElevated: boolean) => {
  elevatedBoxIds.value = {
    ...elevatedBoxIds.value,
    [boxId]: isElevated,
  }
}

const scheduleBoxElevation = (boxId: string, isElevated: boolean, delayMs: number) => {
  clearBoxElevationTimer(boxId)

  if (delayMs <= 0) {
    setBoxElevation(boxId, isElevated)
    return
  }

  boxElevationTimers[boxId] = setTimeout(() => {
    setBoxElevation(boxId, isElevated)
    boxElevationTimers[boxId] = null
  }, delayMs)
}

const clearDetailsRevealTimer = () => {
  if (!detailsRevealTimer) {
    return
  }

  clearTimeout(detailsRevealTimer)
  detailsRevealTimer = null
}

const scheduleDetailsReveal = (boxId: string | null) => {
  clearDetailsRevealTimer()
  detailsVisibleBoxId.value = null

  if (!boxId) {
    return
  }

  detailsRevealTimer = setTimeout(() => {
    detailsVisibleBoxId.value = boxId
    detailsRevealTimer = null
  }, BOX_DETAILS_REVEAL_DELAY_MS)
}

const updateSelectedBoxPosition = async () => {
  await nextTick()

  if (!selectedBoxId.value) {
    selectedBoxMoveX.value = {}
    return
  }

  const activeItem = boxItemRefs.value[selectedBoxId.value]
  if (!activeItem) {
    return
  }

  const activeScene = activeItem.querySelector<HTMLElement>('.scene')
  const targetRect = activeScene?.getBoundingClientRect() || activeItem.getBoundingClientRect()
  const windowCenter = window.innerWidth / 2
  const itemCenter = targetRect.left + targetRect.width / 2

  selectedBoxMoveX.value = {
    [selectedBoxId.value]: windowCenter - itemCenter,
  }
}

const isCardAlreadyRead = (card: CardType) => {
  const slug = card.slug || ''
  if (!slug) {
    return false
  }

  const state = stateBySlug.value[slug]
  return Boolean(state?.flipped || state?.playedToEnd)
}

const scrollToPlaybackCard = async (slug: string) => {
  if (!slug || !playbackRef.value) {
    return
  }

  await nextTick()

  const escapedSlug = slug.replace(/(["\\])/g, '\\$1')
  const selector = `.mix-playback__card-item[data-card-slug="${escapedSlug}"]`
  const cardElement = playbackRef.value.querySelector<HTMLElement>(selector)
  if (!cardElement) {
    return
  }

  cardElement.scrollIntoView({
    behavior: 'smooth',
    block: 'nearest',
    inline: 'center',
  })
}

const handleTrackStarted = (card: CardType) => {
  const slug = card.slug || ''
  if (!slug) {
    return
  }

  playbackStartSlug.value = slug
  playbackIsPlaying.value = true
}

const handlePlaybackStateChanged = (payload: { card: CardType, isPlaying: boolean }) => {
  const slug = payload.card.slug || ''
  if (!slug) {
    return
  }

  if (playbackStartSlug.value !== slug) {
    playbackStartSlug.value = slug
  }

  playbackIsPlaying.value = payload.isPlaying
}

const isCurrentlyPlayingCard = (card: CardType) => {
  const slug = card.slug || ''
  if (!slug) {
    return false
  }

  return playbackIsPlaying.value && playbackStartSlug.value === slug
}

const queuePlaybackFromCard = async (card: CardType) => {
  if (!playbackBoxId.value) {
    return
  }

  const slug = card.slug || ''
  if (slug) {
    void scrollToPlaybackCard(slug)
  }

  if (slug && playbackStartSlug.value === slug) {
    const nextIsPlaying = await tarotDeckRef.value?.togglePlayback?.()
    if (typeof nextIsPlaying === 'boolean') {
      playbackIsPlaying.value = nextIsPlaying
    }
    return
  }

  playbackStartSlug.value = slug
}

const openSelectedBoxPlayback = async () => {
  if (!selectedBoxId.value) {
    return
  }

  playbackBoxId.value = selectedBoxId.value
  playbackBoxFace.value = selectedBoxFace.value
  playbackStartSlug.value = null
  await syncRouteWithPlayback()
}

const resolveFaceForBox = (box: BoxDetails): 'A' | 'B' => {
  const hasSideA = box.cards.some(card => (card.box_side || '').toUpperCase() === 'A')
  if (hasSideA) {
    return 'A'
  }

  const hasSideB = box.cards.some(card => (card.box_side || '').toUpperCase() === 'B')
  if (hasSideB) {
    return 'B'
  }

  return 'A'
}

const resolveRequestedFaceForBox = (box: BoxDetails, requestedFace: 'A' | 'B' | null): 'A' | 'B' => {
  const hasSideA = box.cards.some(card => (card.box_side || '').toUpperCase() === 'A')
  const hasSideB = box.cards.some(card => (card.box_side || '').toUpperCase() === 'B')

  if (requestedFace === 'B' && hasSideB) {
    return 'B'
  }

  if (requestedFace === 'A' && hasSideA) {
    return 'A'
  }

  return resolveFaceForBox(box)
}

const parseRouteBoxTarget = (rawId: string) => {
  const normalized = rawId.trim()
  if (!normalized) {
    return { boxId: '', requestedFace: null as 'A' | 'B' | null }
  }

  const suffix = normalized.slice(-1).toUpperCase()
  if ((suffix === 'A' || suffix === 'B') && normalized.length > 1) {
    return {
      boxId: normalized.slice(0, -1),
      requestedFace: suffix as 'A' | 'B',
    }
  }

  return {
    boxId: normalized,
    requestedFace: null as 'A' | 'B' | null,
  }
}

const clearSelectionState = () => {
  selectedBoxId.value = null
  selectedBoxFace.value = 'A'
  playbackBoxId.value = null
  playbackBoxFace.value = 'A'
  playbackStartSlug.value = null
  playbackIsPlaying.value = false
}

const syncRouteWithPlayback = async () => {
  const targetId = playbackBoxId.value
    ? `${playbackBoxId.value}${playbackBoxFace.value === 'B' ? 'B' : ''}`
    : ''
  const targetPath = targetId ? `/compilation/${targetId}` : '/compilation'

  if (route.path === targetPath) {
    return
  }

  await navigateTo(targetPath, { replace: true })
}

const openBoxFromRoute = async (rawRouteId: string) => {
  const { boxId, requestedFace } = parseRouteBoxTarget(rawRouteId)
  if (!boxId) {
    clearSelectionState()
    await navigateTo('/compilation', { replace: true })
    return
  }

  const box = await boxStore.fetchBoxById(boxId)
  if (!box) {
    clearSelectionState()
    await navigateTo('/compilation', { replace: true })
    return
  }

  const face = resolveRequestedFaceForBox(box, requestedFace)
  selectedBoxId.value = boxId
  selectedBoxFace.value = face
  playbackBoxId.value = boxId
  playbackBoxFace.value = face
  playbackStartSlug.value = null
}

const toggleBoxSelection = async (boxId: string, face: 'A' | 'B') => {
  if (selectedBoxId.value === boxId) {
    selectedBoxFace.value = face
    playbackBoxId.value = boxId
    playbackBoxFace.value = face
    playbackStartSlug.value = null
    await updateSelectedBoxPosition()
    await syncRouteWithPlayback()
    return
  }

  selectedBoxId.value = boxId
  selectedBoxFace.value = face
  playbackBoxId.value = null
  playbackStartSlug.value = null
  await updateSelectedBoxPosition()
  await syncRouteWithPlayback()
}

const syncSelectedFace = (boxId: string, face: 'A' | 'B') => {
  if (selectedBoxId.value !== boxId) {
    return
  }

  selectedBoxFace.value = face

  if (playbackBoxId.value === boxId) {
    playbackBoxFace.value = face
    void syncRouteWithPlayback()
  }
}

const resetSelection = async () => {
  clearSelectionState()
  selectedBoxMoveX.value = {}
  scheduleDetailsReveal(null)
  await syncRouteWithPlayback()
}

const onWindowResize = () => {
  if (!selectedBoxId.value) {
    return
  }

  void updateSelectedBoxPosition()
}

const onGlobalKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Escape') return
  void resetSelection()
}

const onGlobalPointerDown = (event: PointerEvent) => {
  const shelf = shelfRef.value
  const playback = playbackRef.value
  if (!shelf && !playback) return

  const target = event.target as Node | null
  if (target && shelf?.contains(target)) return
  if (target && playback?.contains(target)) return

  void resetSelection()
}

const renderedBoxes = computed(() => {
  return boxStore.boxes
    .map(item => boxStore.boxById[item.id])
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
})

watch(selectedBoxId, (nextBoxId, previousBoxId) => {
  if (previousBoxId && previousBoxId !== nextBoxId) {
    setBoxElevation(previousBoxId, true)
    scheduleBoxElevation(previousBoxId, false, BOX_Z_INDEX_CLOSE_DELAY_MS)
  }

  scheduleDetailsReveal(nextBoxId)

  if (!nextBoxId || nextBoxId === previousBoxId) {
    return
  }

  setBoxElevation(nextBoxId, false)
  scheduleBoxElevation(nextBoxId, true, BOX_Z_INDEX_OPEN_DELAY_MS)
})

onMounted(async () => {
  ensureLoaded()
  window.addEventListener('keydown', onGlobalKeydown)
  window.addEventListener('resize', onWindowResize)
  document.addEventListener('pointerdown', onGlobalPointerDown)

  const boxes = await boxStore.fetchBoxes()
  if (!boxes.length) return

  await Promise.all(boxes.map(item => boxStore.fetchBoxById(item.id)))

  if (routeBoxId.value) {
    await openBoxFromRoute(routeBoxId.value)
    await updateSelectedBoxPosition()
  }

  routeSyncReady.value = true
})

watch(routeBoxId, async (nextRouteBoxId) => {
  if (!routeSyncReady.value) {
    return
  }

  if (!nextRouteBoxId) {
    if (playbackBoxId.value) {
      clearSelectionState()
      selectedBoxMoveX.value = {}
    }
    return
  }

  if (playbackBoxId.value === nextRouteBoxId) {
    return
  }

  await openBoxFromRoute(nextRouteBoxId)
  await updateSelectedBoxPosition()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
  window.removeEventListener('resize', onWindowResize)
  document.removeEventListener('pointerdown', onGlobalPointerDown)

  clearDetailsRevealTimer()
  Object.keys(boxElevationTimers).forEach(clearBoxElevationTimer)
})
</script>

<style scoped lang="scss">
.mix-head {
  display: grid;
  gap: 0.35rem;
}

.mix-current-box {
  position: fixed;
  top: 12px;
  left: 12px;
  z-index: 5;

  h1 {
    margin: 0;
    font-size: clamp(1rem, 2.6vw, 1.35rem);
    letter-spacing: 0.04em;
  }
}

.mix-head h1 {
  margin: 0;
  font-size: 1rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.mix-head p {
  margin: 0;
  color: rgba(25, 17, 10, 0.78);
}

.mix-shelf {
  position: relative;
  display: flex;
  gap: 1rem;
  min-width: 100vw;
  height: 100svh;
  overflow-y: hidden;
  overflow-x: visible;
  align-items: center;
  justify-content: center;

  &::before {
    content: '';
    position: fixed;
    inset: 0;
    z-index: 4;
    background: rgba(0, 0, 0, 0.8);
    opacity: 0;
    pointer-events: none;
    transition: opacity 600ms ease;
  }
}

.mix-shelf--has-active::before {
  opacity: 1;
}

.mix-shelf__item {
  position: relative;
  z-index: var(--item-z-index, 1);
  flex: 0 0 auto;
  transition: transform 600ms cubic-bezier(.22, 1, .36, 1);
}

.mix-shelf__item--active {
  transform: translateX(var(--move-x));
}

.mix-shelf__details {
  position: absolute;
  top: calc(100% + 1rem);
  left: 50%;
  transform: translateX(-50%);
  width: min(32rem, calc(100vw - 2rem));
  display: flex;
  gap: 2rem;
  flex-direction: column;
  align-items: center;
  padding-top: 0.25rem;
  z-index: 11;
}

.mix-shelf__play {
  cursor: pointer;
  width: 80px;
}

.mix-shelf__quote {
  margin: 0;
  display: grid;
  gap: 2rem;
  text-align: center;

  p {
    margin: 0;
    display: grid;
    gap: 0.25rem;
    color: rgba(255, 248, 235, 0.92);
    font-size: clamp(0.95rem, 1.9vw, 1.1rem);
    line-height: 1.55;
  }

  footer {
    margin: 0;
    color: rgba(255, 248, 235, 0.62);
    font-size: 0.8rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
}

.mix-shelf__quote-line {
  display: block;
}

.mix-shelf-details-enter-active,
.mix-shelf-details-leave-active {
  transition:
    opacity 260ms ease,
    transform 360ms cubic-bezier(.22, 1, .36, 1);
}

.mix-shelf-details-enter-from,
.mix-shelf-details-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-12px) scale(0.98);
}

.mix-shelf-details-enter-to,
.mix-shelf-details-leave-from {
  opacity: 1;
  transform: translateX(-50%) translateY(0) scale(1);
}

.mix-page {
  overflow: visible;
}

.mix-playback {
  position: fixed;
  inset: auto 0 0 0;
  z-index: 4;
  display: grid;
  gap: 10px;
  padding: 12px;
  backdrop-filter: blur(6px);
}

.mix-playback__cards {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(220px, 1fr);
  gap: 8px;
  overflow-x: auto;
  overflow-y: hidden;
}

.mix-playback__card-item {
  width: clamp(130px, 16vw, 210px);
  aspect-ratio: 7 / 10;
  min-height: 0;
}
</style>
