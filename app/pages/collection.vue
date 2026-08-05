<template>
  <section v-if="allCardsError" class="collection-toolbar">
    <p class="collection-toolbar__error">
      {{ allCardsError }}
    </p>
  </section>

  <div v-if="nfcStatus" class="toast toast-top toast-center collection-toast">
    <div role="alert" class="alert" :class="nfcStatusTone === 'error' ? 'alert-error' : 'alert-success'">
      <span>{{ nfcStatus }}</span>
    </div>
  </div>

  <article v-for="card in displayedCards" :key="card.slug || card.esid" class="collection-card">
    <Card :card="card" :is-face-up="true" :show-play-button="false" :selectable="true" :selected="isCardSelected(card)"
      click-behavior="self-play" @update:selected="updateCardSelection(card, $event)" />
  </article>
  <CollectionActions class="fixed bottom-20" :selected-count="selectedCount" :show-nfc="hasCurrentlyPlayingCard"
    :is-writing-nfc="isWritingNfc" :is-loading-all-cards="isLoadingAllCards"
    :all-cards-button-label="allCardsButtonLabel" @nfc="writeCurrentTrackToNfc" @clear-selection="clearSelectedCards"
    @toggle-all-cards="toggleAllCards" />
</template>

<script setup lang="ts">
import type { Card as CardType } from '~~/types/types'

type CardListResponse = {
  data: CardType[]
  pagination?: {
    hasNext?: boolean
  }
}

const ALL_CARDS_PAGE_SIZE = 1000
const NFC_TOAST_DURATION_MS = 3600

const { data, pending, error } = await useFetch<{
  data: CardType[]
}>('/api/card', {
  query: {
    limit: 500,
    page: 1,
  },
})

const cards = computed<CardType[]>(() => data.value?.data || [])
const { ensureLoaded, flippedSlugs } = usePersistentCardState()
const { openCardId } = useCardOpenState()
const showAllCards = ref(false)
const isLoadingAllCards = ref(false)
const allCardsError = ref('')
const allCards = ref<CardType[]>([])
const nfcStatus = ref('')
const nfcStatusTone = ref<'success' | 'error' | ''>('')
const isWritingNfc = ref(false)
const selectedCardSlugs = ref<Set<string>>(new Set())
let nfcToastTimer: ReturnType<typeof setTimeout> | null = null

type WebNfcWriter = {
  write: (message: unknown) => Promise<void>
}

const collectedCards = computed<CardType[]>(() => {
  if (flippedSlugs.value.size === 0) {
    return []
  }

  return cards.value.filter(card => {
    const slug = card.slug || ''
    return slug.length > 0 && flippedSlugs.value.has(slug)
  })
})

const displayedCards = computed<CardType[]>(() => {
  if (showAllCards.value) {
    return allCards.value
  }

  return collectedCards.value
})

const currentlyPlayingCard = computed<CardType | null>(() => {
  const slug = openCardId.value
  if (!slug) {
    return null
  }

  return displayedCards.value.find(card => card.slug === slug) || null
})

const hasCurrentlyPlayingCard = computed(() => Boolean(currentlyPlayingCard.value))
const selectedCount = computed(() => selectedCardSlugs.value.size)

const isCardSelected = (card: CardType) => {
  const slug = card.slug || ''
  return slug.length > 0 && selectedCardSlugs.value.has(slug)
}

const allCardsButtonLabel = computed(() => {
  if (isLoadingAllCards.value) {
    return 'Loading all cards...'
  }

  return showAllCards.value ? 'Collection only' : 'All cards'
})

const fetchAllCards = async () => {
  const nextCards: CardType[] = []
  let page = 1
  let hasNext = true

  while (hasNext) {
    const response = await $fetch<CardListResponse>('/api/card', {
      query: {
        limit: ALL_CARDS_PAGE_SIZE,
        page,
      },
    })

    nextCards.push(...(response.data || []))
    hasNext = Boolean(response.pagination?.hasNext)
    page += 1
  }

  allCards.value = nextCards
}

const toggleAllCards = async () => {
  allCardsError.value = ''

  if (showAllCards.value) {
    showAllCards.value = false
    return
  }

  if (allCards.value.length > 0) {
    showAllCards.value = true
    return
  }

  isLoadingAllCards.value = true

  try {
    await fetchAllCards()
    showAllCards.value = true
  } catch (fetchError) {
    console.error(fetchError)
    allCardsError.value = 'Failed to load all cards.'
  } finally {
    isLoadingAllCards.value = false
  }
}

const canWriteNfc = () => {
  if (typeof window === 'undefined') {
    return false
  }

  return window.isSecureContext && 'NDEFReader' in window
}

const getCardUrl = (card: CardType) => {
  const relative = card.slug ? `/card/${card.slug}` : card.url_audio || '/'
  if (typeof window === 'undefined') {
    return relative
  }

  return new URL(relative, window.location.origin).toString()
}

const getNfcErrorMessage = (error: unknown) => {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') {
      return 'Permission NFC refusee. Autorise le NFC et reessaie.'
    }
    if (error.name === 'NotSupportedError') {
      return 'NFC non supporte sur cet appareil.'
    }
    if (error.name === 'NetworkError') {
      return 'Aucun tag NFC detecte. Approche un tag puis reessaie.'
    }

    return `Erreur NFC: ${error.message}`
  }

  return 'Ecriture NFC impossible.'
}

const showNfcToast = (tone: 'success' | 'error', message: string) => {
  nfcStatusTone.value = tone
  nfcStatus.value = message

  if (nfcToastTimer) {
    clearTimeout(nfcToastTimer)
  }

  nfcToastTimer = setTimeout(() => {
    nfcStatus.value = ''
    nfcStatusTone.value = ''
    nfcToastTimer = null
  }, NFC_TOAST_DURATION_MS)
}

const updateCardSelection = (card: CardType, selected: boolean) => {
  const slug = card.slug || ''
  if (!slug) {
    return
  }

  const nextSelection = new Set(selectedCardSlugs.value)

  if (selected) {
    nextSelection.add(slug)
  } else {
    nextSelection.delete(slug)
  }

  selectedCardSlugs.value = nextSelection
}

const clearSelectedCards = () => {
  selectedCardSlugs.value = new Set()
}

const writeCurrentTrackToNfc = async () => {
  nfcStatus.value = ''
  nfcStatusTone.value = ''

  const card = currentlyPlayingCard.value

  if (!canWriteNfc() || typeof window === 'undefined') {
    showNfcToast('error', 'NDEFReader indisponible dans ce navigateur.')
    return
  }

  const NdefReader = (window as Window & {
    NDEFReader?: new () => WebNfcWriter
  }).NDEFReader

  if (!NdefReader) {
    showNfcToast('error', 'NDEFReader indisponible dans ce navigateur.')
    return
  }

  try {
    isWritingNfc.value = true
    const writer = new NdefReader()
    await writer.write({
      records: [{
        recordType: 'url',
        data: getCardUrl(card),
      }],
    })

    showNfcToast('success', `Tag NFC ecrit: ${card.title}`)
  } catch (writeError) {
    showNfcToast('error', getNfcErrorMessage(writeError))
    console.error('Collection NFC error', writeError)
  } finally {
    isWritingNfc.value = false
  }
}

const cardAction = (payload: { button: string; card: CardType }) => {
  console.log(payload)
}

onMounted(() => {
  ensureLoaded()
})

onBeforeUnmount(() => {
  if (nfcToastTimer) {
    clearTimeout(nfcToastTimer)
    nfcToastTimer = null
  }
})
</script>

<style scoped lang="scss">
.collection-toast {
  z-index: 60;
}

.collection-toolbar {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px 4px;
}

.collection-toolbar__error {
  margin: 0;
  font-size: 0.875rem;
  color: #b91c1c;
}

.collection-card {
  padding: 0 10px;

  .card {
    width: 160px;
    margin: 10px;

    &.open {
      transform: scale(1.5);
      z-index: 10;
    }
  }
}
</style>