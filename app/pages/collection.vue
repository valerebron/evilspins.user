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

  <article v-for="card in displayedCards" :key="card.slug || card.esid" class="collection-card">
    <Card :card="card" :is-face-up="true" :show-play-button="false" :selectable="true" :selected="isCardSelected(card)"
      click-behavior="self-play" @update:selected="updateCardSelection(card, $event)" />
  </article>
  <CollectionActions class="fixed bottom-20" :selected-count="selectedCount" :show-nfc="selectedCount > 0"
    :is-writing-nfc="isWritingNfc" :is-nfc-disabled="!isNfcAvailable" :nfc-title="nfcButtonTitle"
    :is-loading-all-cards="isLoadingAllCards"
    :all-cards-button-label="allCardsButtonLabel" @nfc="writeCurrentTrackToNfc" @print="printSelectedCards"
    @clear-selection="clearSelectedCards" @toggle-all-cards="toggleAllCards" />
</template>

<script setup lang="ts">
import type { Card as CardType } from '~~/types/types'
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
const isPrintModalOpen = ref(false)
const printModalRef = ref<HTMLDialogElement | null>(null)
const selectedCardSlugs = ref<Set<string>>(new Set())
const selectedCardsBySlug = ref<Record<string, CardType>>({})
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

const selectedCount = computed(() => selectedCardSlugs.value.size)
const selectedCardsForPrint = computed<PrintCardItem[]>(() => {
  return Object.values(selectedCardsBySlug.value) as PrintCardItem[]
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

const printSelectedCards = async () => {
  if (selectedCardsForPrint.value.length === 0) {
    return
  }

  isPrintModalOpen.value = true
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

const cardAction = (payload: { button: string; card: CardType }) => {
  console.log(payload)
}

watch(selectedCount, (count) => {
  if (count < 1) {
    isPrintModalOpen.value = false
  }
})

watch(isPrintModalOpen, (open) => {
  void syncPrintModal(open)
})

onMounted(() => {
  ensureLoaded()
  void syncPrintModal(isPrintModalOpen.value)
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