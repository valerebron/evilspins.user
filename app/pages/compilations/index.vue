<template>
  <main class="mix-page">
    <section v-if="renderedBoxes.length" ref="shelfRef" class="mix-shelf"
      :class="{ 'mix-shelf--has-active': Boolean(selectedBoxId) }">
      <div v-for="(item, index) in renderedBoxes" :key="item.id" :ref="(el) => setBoxItemRef(item.id, el)"
        class="mix-shelf__item" :class="{
          'mix-shelf__item--active': selectedBoxId === item.id,
          'mix-shelf__item--details-visible': detailsVisibleBoxId === item.id,
          'mix-shelf__item--opening': openingPlaybackBoxId === item.id,
        }" :style="getBoxItemStyle(item.id)">
        <Box :box="item" :is-selected="selectedBoxId === item.id" :mode-rotations="rotations"
          :enter-delay-ms="index * 90" :disableInteraction="false"
          @toggle-select="(face) => toggleBoxSelection(item.id, face)"
          @face-changed="(face) => syncSelectedFace(item.id, face)" :tabindex="index" />

        <Transition name="mix-shelf-details">
          <section v-if="detailsVisibleBoxId === item.id && selectedBoxQuote" class="mix-shelf__details">
            <PlayButton class="mix-shelf__play" interactive :is-playing="false" :aria-label="`Lire ${item.name}`"
              @click.stop="openSelectedBoxPlayback" />

            <blockquote class="mix-shelf__quote">
              <p>
                <span v-for="(line, lineIndex) in selectedBoxQuote.lines" :key="`${item.id}:${lineIndex}`"
                  class="mix-shelf__quote-line">
                  {{ line }}
                </span>
              </p>
              <footer class="mix-shelf__quote-author text-esyellow font-bold text-center"
                v-if="selectedBoxQuote.authorName">
                <a v-if="selectedBoxQuote.authorUrl" class="mix-shelf__quote-author-link"
                  :href="selectedBoxQuote.authorUrl" target="_blank" rel="noreferrer noopener">
                  {{ selectedBoxQuote.authorName }}
                </a>
                <span v-else>{{ selectedBoxQuote.authorName }}</span>
              </footer>
            </blockquote>
          </section>
        </Transition>
      </div>
    </section>

  </main>
</template>

<script setup lang="ts">
import type { BoxDetails } from '~~/types/types'
import type { ComponentPublicInstance } from 'vue'
import PlayButton from '~/components/UI/PlayButton.vue'

type BoxMode = 'stored' | 'selected'
type Rotation = {
  x: number
  y: number
  z: number
}

type QuoteAuthorDetails = {
  name: string
  url: string | null
}

const boxStore = useBoxStore()
const selectedBoxId = ref<string | null>(null)
const selectedBoxFace = ref<'A' | 'B'>('A')
const shelfRef = ref<HTMLElement | null>(null)
const boxItemRefs = ref<Record<string, HTMLElement | null>>({})
const elevatedBoxIds = ref<Record<string, boolean>>({})
const selectedBoxMoveX = ref<Record<string, number>>({})
const detailsVisibleBoxId = ref<string | null>(null)
const { ensureLoaded } = usePersistentCardState()
const BOX_Z_INDEX_OPEN_DELAY_MS = 100
const BOX_Z_INDEX_CLOSE_DELAY_MS = 570
const BOX_DETAILS_REVEAL_DELAY_MS = 1000
const BOX_OPENING_ANIMATION_MS = 620
const boxElevationTimers: Record<string, ReturnType<typeof setTimeout> | null> = {}
let detailsRevealTimer: ReturnType<typeof setTimeout> | null = null
const openingPlaybackBoxId = ref<string | null>(null)
let playbackOpenTimer: ReturnType<typeof setTimeout> | null = null

const rotations = ref<Record<BoxMode, Rotation>>({
  stored: { x: -18, y: -1, z: 90 },
  selected: { x: 29, y: 18, z: 88 },
})

const resolveArtistMetadata = (value: unknown): QuoteAuthorDetails | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  const name = typeof record.name === 'string' ? record.name.trim() : ''
  const url = typeof record.url === 'string' && record.url.trim().length > 0
    ? record.url.trim()
    : null

  if (!name) {
    return null
  }

  return { name, url }
}

const resolveQuoteAuthor = (box: BoxDetails, face: 'A' | 'B', rawAuthor: unknown): QuoteAuthorDetails | null => {
  if (rawAuthor === undefined || rawAuthor === null) {
    return null
  }

  const resolvedAuthorObject = resolveArtistMetadata(rawAuthor)
  if (resolvedAuthorObject) {
    return resolvedAuthorObject
  }

  const normalizedAuthor = String(rawAuthor).trim()
  if (!normalizedAuthor) {
    return null
  }

  const authorPosition = Number.parseInt(normalizedAuthor, 10)
  if (Number.isFinite(authorPosition)) {
    const matchingCard = box.cards.find((card) => {
      const cardSide = (card.box_side || '').toUpperCase()
      const isSameSide = !cardSide || cardSide === face
      return isSameSide && card.box_position === authorPosition
    })

    if (matchingCard) {
      const artistMetadata = resolveArtistMetadata(box.artists[matchingCard.esid])
      if (artistMetadata) {
        return artistMetadata
      }

      if (matchingCard.artist?.trim()) {
        return {
          name: matchingCard.artist.trim(),
          url: null,
        }
      }
    }
  }

  const artistByTrackId = resolveArtistMetadata(box.artists[normalizedAuthor])
  if (artistByTrackId) {
    return artistByTrackId
  }

  return {
    name: normalizedAuthor,
    url: null,
  }
}

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

  const author = resolveQuoteAuthor(box, selectedBoxFace.value, quoteSide.author ?? quoteSide.auhor)
  if (!lines.length && !author) {
    return null
  }

  return {
    lines,
    authorName: author?.name || '',
    authorUrl: author?.url || null,
  }
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

const clearPlaybackOpenTimer = () => {
  if (!playbackOpenTimer) {
    return
  }

  clearTimeout(playbackOpenTimer)
  playbackOpenTimer = null
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

const buildCompilationPath = (boxId: string, face: 'A' | 'B') => {
  return `/compilations/${boxId}${face === 'B' ? 'B' : ''}`
}

const finalizePlaybackOpening = async (boxId: string, face: 'A' | 'B') => {
  if (selectedBoxId.value !== boxId) {
    openingPlaybackBoxId.value = null
    return
  }

  openingPlaybackBoxId.value = null
  await navigateTo(buildCompilationPath(boxId, face))
}

const openSelectedBoxPlayback = () => {
  if (!selectedBoxId.value || openingPlaybackBoxId.value) {
    return
  }

  const targetBoxId = selectedBoxId.value
  const targetFace = selectedBoxFace.value

  openingPlaybackBoxId.value = targetBoxId
  // scheduleDetailsReveal(null)
  clearPlaybackOpenTimer()

  playbackOpenTimer = setTimeout(() => {
    playbackOpenTimer = null
    void finalizePlaybackOpening(targetBoxId, targetFace)
  }, BOX_OPENING_ANIMATION_MS)
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

const clearSelectionState = () => {
  clearPlaybackOpenTimer()
  openingPlaybackBoxId.value = null
  selectedBoxId.value = null
  selectedBoxFace.value = 'A'
}

const toggleBoxSelection = async (boxId: string, face: 'A' | 'B') => {
  if (selectedBoxId.value === boxId) {
    selectedBoxFace.value = face
    await updateSelectedBoxPosition()
    return
  }

  selectedBoxId.value = boxId
  selectedBoxFace.value = face
  await updateSelectedBoxPosition()
}

const syncSelectedFace = (boxId: string, face: 'A' | 'B') => {
  if (selectedBoxId.value !== boxId) {
    return
  }

  selectedBoxFace.value = face
}

const resetSelection = async () => {
  clearSelectionState()
  selectedBoxMoveX.value = {}
  scheduleDetailsReveal(null)
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
  if (!selectedBoxId.value) {
    return
  }

  const activeItem = boxItemRefs.value[selectedBoxId.value]
  if (!activeItem) {
    return
  }

  const target = event.target as Node | null
  if (target && activeItem.contains(target)) {
    return
  }

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
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
  window.removeEventListener('resize', onWindowResize)
  document.removeEventListener('pointerdown', onGlobalPointerDown)

  clearPlaybackOpenTimer()
  clearDetailsRevealTimer()
  Object.keys(boxElevationTimers).forEach(clearBoxElevationTimer)
})
</script>

<style scoped lang="scss">
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
    background: #000000;
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
  opacity: 1;
  transition:
    transform 620ms cubic-bezier(.22, 1, .36, 1),
    opacity 480ms ease;
}

.mix-shelf__item--active {
  transform: translateX(var(--move-x)) translateY(0);
}

.mix-shelf__item--active.mix-shelf__item--details-visible {
  transform: translateX(var(--move-x)) translateY(-150px);
}

.mix-shelf__item--active.mix-shelf__item--opening {
  opacity: 0;
  pointer-events: none;
}

.mix-shelf__item :deep(.stacked-card) {
  transition:
    transform 620ms cubic-bezier(.22, 1, .36, 1),
    opacity 520ms ease;
}

.mix-shelf__item--opening :deep(.stacked-card) {
  transform: translate(-50%, calc(-50% + 52svh)) rotateZ(0deg) translateZ(0);
  opacity: 0;
  transition-delay: calc((var(--card-order, 1) - 1) * 36ms);
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
  margin-top: -55px;
  z-index: 20;
}

.mix-shelf__play {
  cursor: pointer;
  width: 80px;

  &:hover {
    transform: scale(1.4);
  }

  &:active {
    transform: scale(1);
  }
}

.mix-shelf__quote {
  margin: 0;
  display: grid;
  gap: 2rem;
  text-align: justify;
  padding: 20px;

  p {
    margin: 0;
    display: grid;
    gap: 0.25rem;
    position: relative;
    color: rgba(255, 248, 235, 0.92);
    font-size: clamp(1.1rem, 1.9vw, 1.1rem);
    line-height: 1.55;

    &::before,
    &::after {
      display: block;
      font-size: 1.5em;
      line-height: 1;
      color: rgba(255, 248, 235, 0.75);
      font-family: serif;
      font-size: 80px;
      position: absolute;
    }

    &::before {
      content: '“';
      top: -50px;
      left: 0;
    }

    &::after {
      content: '”';
      bottom: -70px;
      right: 0;
    }
  }

  footer {
    margin: 0;
    font-size: 0.8rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
}

.mix-shelf__quote-line {
  display: block;

  &:first-child::first-letter {
    text-transform: uppercase;
  }
}

.mix-shelf__quote-author-link {
  color: inherit;
  text-decoration: none;

  &:hover,
  &:focus-visible {
    text-decoration: underline;
  }
}

.mix-shelf-details-enter-active,
.mix-shelf-details-leave-active {
  transition:
    opacity 260ms ease;
}

.mix-shelf-details-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-12px) scale(0.98);
}

.mix-shelf-details-leave-to {
  opacity: 0;
}

.mix-shelf-details-enter-to,
.mix-shelf-details-leave-from {
  opacity: 1;
}

.mix-page {
  overflow: visible;
}
</style>
