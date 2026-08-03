<template>
  <main class="mix-page" :class="{ 'mix-page--playing': isPlaybackOpen }">
    <header v-if="playbackBox" class="mix-current-box">
      <h1>{{ playbackBox.name }}</h1>
    </header>

    <section v-if="renderedBoxes.length" ref="shelfRef" class="mix-shelf">
      <Box :box="item" v-for="(item, index) in renderedBoxes" :is-selected="selectedBoxId === item.id"
        :mode-rotations="rotations" :disableInteraction="false"
        @toggle-select="(face) => toggleBoxSelection(item.id, face)" :key="item.id" :tabindex="index" />
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
import TarotDeck from '~/components/player/TarotDeck.vue'

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
const playbackBoxId = ref<string | null>(null)
const playbackBoxFace = ref<'A' | 'B'>('A')
const playbackStartSlug = ref<string | null>(null)
const playbackIsPlaying = ref(false)
const { ensureLoaded, stateBySlug } = usePersistentCardState()
const routeSyncReady = ref(false)

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
    playbackBoxId.value = boxId
    playbackBoxFace.value = face
    playbackStartSlug.value = null
    await syncRouteWithPlayback()
    return
  }

  selectedBoxId.value = boxId
  selectedBoxFace.value = face
  playbackBoxId.value = null
  playbackStartSlug.value = null
  await syncRouteWithPlayback()
}

const resetSelection = async () => {
  clearSelectionState()
  await syncRouteWithPlayback()
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

onMounted(async () => {
  ensureLoaded()
  window.addEventListener('keydown', onGlobalKeydown)
  document.addEventListener('pointerdown', onGlobalPointerDown)

  const boxes = await boxStore.fetchBoxes()
  if (!boxes.length) return

  await Promise.all(boxes.map(item => boxStore.fetchBoxById(item.id)))

  if (routeBoxId.value) {
    await openBoxFromRoute(routeBoxId.value)
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
    }
    return
  }

  if (playbackBoxId.value === nextRouteBoxId) {
    return
  }

  await openBoxFromRoute(nextRouteBoxId)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
  document.removeEventListener('pointerdown', onGlobalPointerDown)
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
  display: flex;
  // flex-direction: row;
  // align-items: flex-end;
  gap: 1rem;
  // overflow-y: visible;
  // padding: 0.5rem 0.75rem 0.25rem;
  // scrollbar-width: thin;
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
