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

  <dialog ref="printModalRef" class="modal modal-middle" @close="isPrintModalOpen = false">
    <div class="modal-box max-w-2xl">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class="text-lg font-bold">Options d'impression</h2>
          <p class="mt-1 text-sm text-base-content/70">Regle l'imposition avant de lancer l'export PDF.</p>
        </div>
        <form method="dialog">
          <button class="btn btn-sm">Fermer</button>
        </form>
      </div>

      <div
        class="stats stats-vertical mt-4 w-full border border-base-300 bg-base-200/60 shadow-none sm:stats-horizontal">
        <div class="stat px-4 py-3">
          <div class="stat-title">Selection</div>
          <div class="stat-value text-2xl">{{ selectedCount }}</div>
          <div class="stat-desc">carte(s)</div>
        </div>
        <div class="stat px-4 py-3">
          <div class="stat-title">Imposition</div>
          <div class="stat-value text-2xl">{{ printSheetCount }}</div>
          <div class="stat-desc">feuille(s)</div>
        </div>
      </div>

      <div class="mt-5 grid gap-4 sm:grid-cols-2">
        <label class="grid gap-2 text-sm font-medium text-base-content">
          <span>Export</span>
          <select v-model="exportMode" class="select select-sm w-full">
            <option value="duplex">Recto-verso (alternance par feuille)</option>
            <option value="separate">Faces separees (tous les rectos puis les versos)</option>
          </select>
        </label>

        <label class="grid gap-2 text-sm font-medium text-base-content">
          <span>Alignement verso</span>
          <select v-model="backAlignment" class="select select-sm w-full">
            <option value="mirror">Miroir horizontal (duplex: retourner sur bord court)</option>
            <option value="aligned">Aligne sans miroir</option>
          </select>
        </label>

        <label class="grid gap-2 text-sm font-medium text-base-content sm:col-span-2">
          <span>Papier</span>
          <select v-model="paperFormat" class="select select-sm w-full">
            <option v-for="[formatId, format] in paperFormatEntries" :key="formatId" :value="formatId">
              {{ format.label }}
            </option>
          </select>
        </label>

        <label
          class="flex items-center gap-3 rounded-box border border-base-300 px-4 py-3 text-sm font-medium text-base-content">
          <input v-model="includeCutMarks" type="checkbox" class="checkbox checkbox-sm" />
          <span>Marques de coupe</span>
        </label>

        <label
          class="flex items-center gap-3 rounded-box border border-base-300 px-4 py-3 text-sm font-medium text-base-content">
          <input v-model="roundedFront" type="checkbox" class="checkbox checkbox-sm" />
          <span>Arrondis recto</span>
        </label>

        <label
          class="flex items-center gap-3 rounded-box border border-base-300 px-4 py-3 text-sm font-medium text-base-content sm:col-span-2">
          <input v-model="includeLaminationMargin" type="checkbox" class="checkbox checkbox-sm" />
          <span>Marges plastification 2 mm</span>
        </label>
      </div>

      <p class="mt-4 text-sm leading-6 text-base-content/70">
        PDF genere en {{ selectedPaperFormat.label }}. Pour conserver 85,60 x 53,98 mm apres decoupe, imprime a 100%
        sans "Ajuster" ni "Adapter a la page".
      </p>

      <p v-if="pdfError" class="mt-4 text-sm text-error">{{ pdfError }}</p>

      <div class="modal-action mt-6">
        <button type="button" class="btn btn-soft" :disabled="selectedCount === 0 || isGeneratingPdf"
          @click="clearSelectedCards">
          Vider la selection
        </button>
        <button type="button" class="btn" :disabled="selectedCount === 0 || isGeneratingPdf" @click="generatePdf">
          {{ isGeneratingPdf ? 'Generation...' : `Generer le PDF (${selectedCount} carte${selectedCount > 1 ? 's' :
            ''})` }}
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  </dialog>

  <dialog ref="editLocalCardModalRef" class="modal modal-middle" @close="isEditLocalCardModalOpen = false">
    <div class="modal-box max-w-lg">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class="text-lg font-bold">Edit local card</h2>
          <p class="mt-1 text-sm text-base-content/70">Modifie les infos de la carte locale.</p>
        </div>
        <form method="dialog">
          <button class="btn btn-sm">Fermer</button>
        </form>
      </div>

      <form class="mt-5 grid gap-4" @submit.prevent="saveLocalCardEdition">
        <label class="grid gap-2 text-sm font-medium text-base-content">
          <span>Artiste</span>
          <input v-model="editLocalCardArtist" type="text" class="input w-full" placeholder="Nom de l'artiste" />
        </label>

        <label class="grid gap-2 text-sm font-medium text-base-content">
          <span>Titre</span>
          <input v-model="editLocalCardTitle" type="text" class="input w-full" placeholder="Titre" />
        </label>

        <label class="grid gap-2 text-sm font-medium text-base-content">
          <span>Suit</span>
          <select v-model="editLocalCardSuit" class="select w-full">
            <option v-for="suit in CARD_SUITS" :key="suit" :value="suit">{{ suit }}</option>
          </select>
        </label>

        <label class="grid gap-2 text-sm font-medium text-base-content">
          <span>Rank</span>
          <select v-model="editLocalCardRank" class="select w-full">
            <option v-for="rank in CARD_RANKS" :key="rank" :value="rank">{{ rank }}</option>
          </select>
        </label>

        <p v-if="editLocalCardError" class="text-sm text-error">{{ editLocalCardError }}</p>

        <div class="modal-action">
          <button type="button" class="btn btn-soft" @click="closeLocalCardEdition">Annuler</button>
          <button type="submit" class="btn">Sauvegarder</button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  </dialog>

  <article v-for="card in displayedCards" :key="card.slug || card.esid" class="collection-card">
    <Card :card="card" :is-face-up="true" :show-play-button="false" :selectable="true" :selected="isCardSelected(card)"
      click-behavior="self-play" @update:selected="updateCardSelection(card, $event)" />

    <div v-if="isLocalCard(card)" class="collection-card__local-actions">
      <button type="button" class="btn btn-xs" @click="openLocalCardEdition(card)">
        edit
      </button>
      <button type="button" class="btn btn-xs btn-error" @click="removeLocalCard(card)">
        supprimer
      </button>
    </div>
  </article>
  <CollectionActions class="fixed bottom-20" :selected-count="selectedCount" :show-nfc="selectedCount > 0"
    :is-writing-nfc="isWritingNfc" :is-nfc-disabled="!isNfcAvailable" :nfc-title="nfcButtonTitle"
    :is-loading-all-cards="isLoadingAllCards" :all-cards-button-label="allCardsButtonLabel"
    @nfc="writeCurrentTrackToNfc" @print="printSelectedCards" @mix="goToMix" @create-card="goToCreateCard"
    @clear-selection="clearSelectedCards" @toggle-all-cards="toggleAllCards" />
</template>

<script setup lang="ts">
import type { Card as CardType, Rank, Suit } from '~~/types/types'
import { usePrintPdf } from '~/composables/usePrintPdf'
import {
  PAPER_FORMATS,
  getSheetCount,
  type BackAlignmentMode,
  type PaperFormatId,
  type PrintCardItem,
  type PrintExportMode,
} from '~/utils/print'

type CardListResponse = {
  data: CardType[]
  pagination?: {
    hasNext?: boolean
  }
}

const ALL_CARDS_PAGE_SIZE = 1000
const NFC_TOAST_DURATION_MS = 3600
const CARD_SUITS: Suit[] = ['♠', '♥', '♦', '♣']
const CARD_RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'V', 'D', 'R']

const { data, pending, error } = await useFetch<{
  data: CardType[]
}>('/api/card', {
  query: {
    limit: 500,
    page: 1,
  },
})

const cards = computed<CardType[]>(() => data.value?.data || [])
const { ensureLoaded, flippedSlugs, stateBySlug } = usePersistentCardState()
const {
  localCards,
  ensureLoaded: ensureLocalCardsLoaded,
  updateLocalCard,
  deleteLocalCard,
} = useLocalCards()
const { openCardId } = useCardOpenState()
const showAllCards = ref(false)
const isLoadingAllCards = ref(false)
const allCardsError = ref('')
const allCards = ref<CardType[]>([])
const nfcStatus = ref('')
const nfcStatusTone = ref<'success' | 'error' | ''>('')
const isWritingNfc = ref(false)
const isPrintModalOpen = ref(false)
const printModalRef = ref<HTMLDialogElement | null>(null)
const isEditLocalCardModalOpen = ref(false)
const editLocalCardModalRef = ref<HTMLDialogElement | null>(null)
const editingLocalCardSlug = ref('')
const editLocalCardArtist = ref('')
const editLocalCardTitle = ref('')
const editLocalCardSuit = ref<Suit>('♠')
const editLocalCardRank = ref<Rank>('A')
const editLocalCardError = ref('')
const selectedCardSlugs = ref<Set<string>>(new Set())
const selectedCardsBySlug = ref<Record<string, CardType>>({})
const mixCardsStore = useMixCardsStore()
let nfcToastTimer: ReturnType<typeof setTimeout> | null = null
const exportMode = ref<PrintExportMode>('duplex')
const backAlignment = ref<BackAlignmentMode>('mirror')
const paperFormat = ref<PaperFormatId>('a4')
const includeCutMarks = ref(true)
const roundedFront = ref(true)
const includeLaminationMargin = ref(true)

type WebNfcWriter = {
  write: (message: unknown) => Promise<void>
}

const collectedCards = computed<CardType[]>(() => {
  const mergedCards = mergeCards(cards.value, localCards.value)

  if (flippedSlugs.value.size === 0) {
    return []
  }

  return mergedCards.filter(card => {
    const slug = card.slug || ''
    return slug.length > 0 && flippedSlugs.value.has(slug)
  })
})

const getCardTimestamp = (card: CardType) => {
  const slug = card.slug || ''
  if (slug) {
    const discoveredAt = stateBySlug.value[slug]?.discoveredAt
    if (typeof discoveredAt === 'number' && Number.isFinite(discoveredAt)) {
      return discoveredAt
    }
  }

  const createdAtValue = card.createdAt
  if (createdAtValue) {
    const createdAtTimestamp = new Date(createdAtValue).getTime()
    if (Number.isFinite(createdAtTimestamp)) {
      return createdAtTimestamp
    }
  }

  const year = Number(card.year || 0)
  const month = Number(card.month || 1)
  const day = Number(card.day || 1)
  const hour = Number(card.hour || 0)
  const fallbackTimestamp = new Date(year, Math.max(month - 1, 0), day || 1, hour || 0).getTime()

  return Number.isFinite(fallbackTimestamp) ? fallbackTimestamp : 0
}

const sortCardsByMostRecent = (cardsToSort: CardType[]) => {
  return [...cardsToSort].sort((a, b) => {
    return getCardTimestamp(b) - getCardTimestamp(a)
  })
}

const displayedCards = computed<CardType[]>(() => {
  if (showAllCards.value) {
    return sortCardsByMostRecent(mergeCards(allCards.value, localCards.value))
  }

  return sortCardsByMostRecent(collectedCards.value)
})

const localCardSlugSet = computed(() => {
  const slugs = new Set<string>()

  for (const card of localCards.value) {
    const slug = card.slug || ''
    if (slug) {
      slugs.add(slug)
    }
  }

  return slugs
})

const mergeCards = (primary: CardType[], secondary: CardType[]) => {
  const mergedBySlug = new Map<string, CardType>()

  for (const card of [...secondary, ...primary]) {
    const slug = card.slug || ''
    if (!slug) {
      continue
    }

    if (!mergedBySlug.has(slug)) {
      mergedBySlug.set(slug, card)
    }
  }

  return Array.from(mergedBySlug.values())
}

const currentlyPlayingCard = computed<CardType | null>(() => {
  const slug = openCardId.value
  if (!slug) {
    return null
  }

  return displayedCards.value.find(card => card.slug === slug) || null
})

const selectedCount = computed(() => selectedCardSlugs.value.size)
const selectedCardsForPrint = computed<PrintCardItem[]>(() => {
  return Object.values(selectedCardsBySlug.value) as PrintCardItem[]
})
const selectedCardsForMix = computed<CardType[]>(() => {
  return Array.from(selectedCardSlugs.value)
    .map((slug) => selectedCardsBySlug.value[slug])
    .filter((card): card is CardType => Boolean(card))
})
const selectedCardForNfc = computed<CardType | null>(() => {
  const currentCard = currentlyPlayingCard.value
  if (currentCard?.slug && selectedCardSlugs.value.has(currentCard.slug)) {
    return currentCard
  }

  return selectedCardsForPrint.value[0] || null
})
const paperFormatEntries = Object.entries(PAPER_FORMATS)
const printSheetCount = computed(() => getSheetCount(selectedCardsForPrint.value.length))
const isNfcAvailable = computed(() => canWriteNfc())
const nfcButtonTitle = computed(() => {
  if (isWritingNfc.value) {
    return 'Ecriture NFC en cours'
  }

  if (!isNfcAvailable.value) {
    return 'NDEFReader indisponible dans ce navigateur'
  }

  return selectedCardForNfc.value ? `Ecrire ${selectedCardForNfc.value.title} sur un tag NFC` : 'Selectionne une carte'
})
const {
  generatePdf,
  isGenerating: isGeneratingPdf,
  pdfError,
  selectedPaperFormat,
} = usePrintPdf({
  selectedCards: selectedCardsForPrint,
  exportMode,
  backAlignment,
  paperFormat,
  includeCutMarks,
  roundedFront,
  includeLaminationMargin,
})

const isCardSelected = (card: CardType) => {
  const slug = card.slug || ''
  return slug.length > 0 && selectedCardSlugs.value.has(slug)
}

const isLocalCard = (card: CardType) => {
  const slug = card.slug || ''
  return slug.length > 0 && localCardSlugSet.value.has(slug)
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
    selectedCardsBySlug.value = {
      ...selectedCardsBySlug.value,
      [slug]: card,
    }
  } else {
    nextSelection.delete(slug)
    const nextSelectedCards = { ...selectedCardsBySlug.value }
    delete nextSelectedCards[slug]
    selectedCardsBySlug.value = nextSelectedCards
  }

  selectedCardSlugs.value = nextSelection
}

const clearSelectedCards = () => {
  selectedCardSlugs.value = new Set()
  selectedCardsBySlug.value = {}
  isPrintModalOpen.value = false
}

const removeCardFromSelection = (slug: string) => {
  if (!slug) {
    return
  }

  if (!selectedCardSlugs.value.has(slug)) {
    return
  }

  const nextSelectedSlugs = new Set(selectedCardSlugs.value)
  nextSelectedSlugs.delete(slug)

  const nextSelectedCards = { ...selectedCardsBySlug.value }
  delete nextSelectedCards[slug]

  selectedCardSlugs.value = nextSelectedSlugs
  selectedCardsBySlug.value = nextSelectedCards
}

const syncPrintModal = async (open: boolean) => {
  if (import.meta.server) {
    return
  }

  await nextTick()
  const modal = printModalRef.value
  if (!modal) {
    return
  }

  if (open) {
    if (!modal.open) {
      modal.showModal()
    }
    return
  }

  if (modal.open) {
    modal.close()
  }
}

const syncEditLocalCardModal = async (open: boolean) => {
  if (import.meta.server) {
    return
  }

  await nextTick()
  const modal = editLocalCardModalRef.value
  if (!modal) {
    return
  }

  if (open) {
    if (!modal.open) {
      modal.showModal()
    }
    return
  }

  if (modal.open) {
    modal.close()
  }
}

const printSelectedCards = async () => {
  if (selectedCardsForPrint.value.length === 0) {
    return
  }

  isPrintModalOpen.value = true
}

const goToMix = async () => {
  if (selectedCardsForMix.value.length === 0) {
    return
  }

  mixCardsStore.setCards(selectedCardsForMix.value)
  await navigateTo('/mix')
}

const goToCreateCard = async () => {
  await navigateTo('/create-card')
}

const openLocalCardEdition = (card: CardType) => {
  if (!isLocalCard(card)) {
    return
  }

  editingLocalCardSlug.value = card.slug || ''
  editLocalCardArtist.value = card.artist || ''
  editLocalCardTitle.value = card.title || ''
  editLocalCardSuit.value = (card.suit as Suit) || '♠'
  editLocalCardRank.value = (card.rank as Rank) || 'A'
  editLocalCardError.value = ''
  isEditLocalCardModalOpen.value = true
}

const closeLocalCardEdition = () => {
  isEditLocalCardModalOpen.value = false
  editLocalCardError.value = ''
}

const saveLocalCardEdition = () => {
  const slug = editingLocalCardSlug.value
  if (!slug) {
    editLocalCardError.value = 'Carte locale introuvable.'
    return
  }

  const title = editLocalCardTitle.value.trim()
  const artist = editLocalCardArtist.value.trim()
  if (!title || !artist) {
    editLocalCardError.value = 'Titre et artiste sont requis.'
    return
  }

  updateLocalCard(slug, {
    title,
    artist,
    suit: editLocalCardSuit.value,
    rank: editLocalCardRank.value,
  })

  const selectedCard = selectedCardsBySlug.value[slug]
  if (selectedCard) {
    selectedCardsBySlug.value = {
      ...selectedCardsBySlug.value,
      [slug]: {
        ...selectedCard,
        title,
        artist,
        suit: editLocalCardSuit.value,
        rank: editLocalCardRank.value,
      },
    }
  }

  closeLocalCardEdition()
}

const removeLocalCard = (card: CardType) => {
  const slug = card.slug || ''
  if (!slug || !isLocalCard(card)) {
    return
  }

  const confirmed = import.meta.client ? window.confirm(`Supprimer ${card.title} ?`) : false
  if (!confirmed) {
    return
  }

  deleteLocalCard(slug)
  removeCardFromSelection(slug)

  if (editingLocalCardSlug.value === slug) {
    closeLocalCardEdition()
  }
}

const writeCurrentTrackToNfc = async () => {
  nfcStatus.value = ''
  nfcStatusTone.value = ''

  const card = selectedCardForNfc.value

  if (!card) {
    showNfcToast('error', 'Aucune carte en lecture.')
    return
  }

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

watch(selectedCount, (count) => {
  if (count < 1) {
    isPrintModalOpen.value = false
  }
})

watch(isPrintModalOpen, (open) => {
  void syncPrintModal(open)
})

watch(isEditLocalCardModalOpen, (open) => {
  void syncEditLocalCardModal(open)
})

onMounted(() => {
  ensureLoaded()
  ensureLocalCardsLoaded()
  void syncPrintModal(isPrintModalOpen.value)
  void syncEditLocalCardModal(isEditLocalCardModalOpen.value)
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
  display: flex;
  flex-direction: column;
  align-items: center;

  .card {
    width: 160px;
    margin: 10px;

    &.open {
      transform: scale(1.5);
      z-index: 10;
    }
  }
}

.collection-card__local-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: -2px;
}
</style>