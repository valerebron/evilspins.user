<template>
  <main class="mix-player-page">
    <section v-if="playbackBoxId" ref="playbackRef" class="mix-playback">
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

const route = useRoute()
const boxStore = useBoxStore()
const { ensureLoaded, stateBySlug } = usePersistentCardState()

const playbackRef = ref<HTMLElement | null>(null)
const tarotDeckRef = ref<InstanceType<typeof TarotDeck> | null>(null)
const playbackBoxId = ref<string | null>(null)
const playbackBoxFace = ref<'A' | 'B'>('A')
const playbackStartSlug = ref<string | null>(null)
const playbackIsPlaying = ref(false)

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

const syncFromRoute = async () => {
  const { boxId, requestedFace } = parseRouteBoxTarget(routeBoxId.value)

  if (!boxId) {
    await navigateTo('/compilation', { replace: true })
    return
  }

  const box = await boxStore.fetchBoxById(boxId)
  if (!box) {
    await navigateTo('/compilation', { replace: true })
    return
  }

  playbackBoxId.value = boxId
  playbackBoxFace.value = resolveRequestedFaceForBox(box, requestedFace)
  playbackStartSlug.value = null
  playbackIsPlaying.value = false
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

onMounted(async () => {
  ensureLoaded()
  await boxStore.fetchBoxes()
  await syncFromRoute()
})

watch(routeBoxId, async () => {
  await syncFromRoute()
})
</script>

<style scoped lang="scss">
.mix-player-page {
  min-height: 100svh;
  padding: 12px;
}

.mix-playback {
  position: relative;
  display: grid;
  gap: 10px;
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
