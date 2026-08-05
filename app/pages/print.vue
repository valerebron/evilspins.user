<template>
  <main class="print-page">
    <header class="hero">
      <p class="eyebrow">Impression cartes bancaire 85.60 x 53.98mm</p>
      <h1>Generateur d'imposition recto-verso</h1>
      <p class="subtitle">
        Commence par rechercher et selectionner des cartes. L'apercu et la generation PDF apparaissent ensuite.
      </p>
      <button type="button" class="menu-open-btn" @click="isOptionsModalOpen = true">Options d'impression</button>
    </header>

    <section class="layout-grid">
      <section class="search-panel">
        <CardSearchPanel mode="embedded" pick-label="Ajouter / Retirer" :close-on-select="false"
          @select="onSelectFromSearch" />
      </section>
    </section>

    <dialog ref="optionsModalRef" class="modal modal-middle" @close="isOptionsModalOpen = false">
      <div class="modal-box max-w-2xl">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-lg font-bold">Options d'impression</h2>
            <p class="mt-1 text-sm text-base-content/70">Prepare l'imposition avant de lancer l'export PDF.</p>
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
            <div class="stat-value text-2xl">{{ sheetCount }}</div>
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

        <div class="modal-action mt-6">
          <button type="button" class="btn btn-soft" :disabled="selectedCount === 0" @click="printStore.clear()">
            Vider la selection
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>

    <p v-if="pdfError" class="error-banner">{{ pdfError }}</p>

    <section class="deck-dock">
      <PrintDeck :cards="selectedCards" :force-expanded="isPdfDockHovered" label="Deck impression"
        @toggle-card="onToggleFromDeck" />
    </section>

    <section v-if="hasSelection" class="pdf-dock" @mouseenter="isPdfDockHovered = true"
      @mouseleave="isPdfDockHovered = false">
      <button type="button" class="primary-btn pdf-dock-btn" :disabled="isGenerating" @click="generatePdf">
        {{ isGenerating ? 'Generation...' : `Generer le PDF (${selectedCount} carte${selectedCount > 1 ? 's' : ''})` }}
      </button>
    </section>

    <p v-else class="empty-state">Selectionne au moins une carte depuis le panneau de recherche pour activer la
      generation PDF.</p>
  </main>
</template>

<script setup lang="ts">
import PrintDeck from '~/components/Print/Deck.vue'
import CardSearchPanel from '~/components/Search/CardSearchPanel.vue'
import { usePrintPdf } from '~/composables/usePrintPdf'
import { usePrintCardsStore } from '~/stores/printCards'
import {
  PAPER_FORMATS,
  getSheetCount,
  type BackAlignmentMode,
  type PaperFormatId,
  type PrintCardItem,
  type PrintExportMode,
} from '~/utils/print'
import type { Card } from '~~/types/types'

definePageMeta({
  title: 'Print',
})

const printStore = usePrintCardsStore()

const exportMode = ref<PrintExportMode>('duplex')
const backAlignment = ref<BackAlignmentMode>('mirror')
const paperFormat = ref<PaperFormatId>('a4')
const includeCutMarks = ref(true)
const roundedFront = ref(true)
const includeLaminationMargin = ref(true)

const isOptionsModalOpen = ref(false)
const optionsModalRef = ref<HTMLDialogElement | null>(null)
const isPdfDockHovered = ref(false)
const route = useRoute()
const hasAutoGenerated = ref(false)

const paperFormatEntries = Object.entries(PAPER_FORMATS)

const selectedCards = computed(() => printStore.selectedCards)
const selectedCount = computed(() => printStore.selectedCount)
const sheetCount = computed(() => getSheetCount(selectedCount.value))
const hasSelection = computed(() => selectedCount.value > 0)
const {
  generatePdf,
  isGenerating,
  pdfError,
  selectedPaperFormat,
} = usePrintPdf({
  selectedCards,
  exportMode,
  backAlignment,
  paperFormat,
  includeCutMarks,
  roundedFront,
  includeLaminationMargin,
})

watch(sheetCount, (count) => {
  if (count < 1) {
    pdfError.value = ''
  }
})

watch(hasSelection, (has) => {
  if (!has) {
    isPdfDockHovered.value = false
  }
})

const syncOptionsModal = async (open: boolean) => {
  if (import.meta.server) {
    return
  }

  await nextTick()
  const modal = optionsModalRef.value
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

watch(isOptionsModalOpen, (open) => {
  void syncOptionsModal(open)
})

watch(hasSelection, (has) => {
  if (!has || hasAutoGenerated.value || route.query.autogenerate !== '1' || import.meta.server) {
    return
  }

  hasAutoGenerated.value = true
  queueMicrotask(() => {
    void generatePdf()
  })
}, { immediate: true })

const onSelectFromSearch = (card: Card) => {
  printStore.toggleCard(card as PrintCardItem)
}

const onToggleFromDeck = (card: PrintCardItem) => {
  printStore.toggleCard(card)
}

onMounted(() => {
  void syncOptionsModal(isOptionsModalOpen.value)
})
</script>

<style scoped>
.print-page {
  min-height: 100vh;
  padding: clamp(1rem, 2.5vw, 2.2rem);
  color: #112237;
  display: grid;
  gap: 1.15rem;
}

.hero {
  border: 1px solid #ceddea;
  border-radius: 1rem;
  padding: clamp(1rem, 2vw, 1.5rem);
  display: grid;
  gap: 0.45rem;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.95), rgba(237, 245, 252, 0.95));
}

.eyebrow {
  font-size: 0.78rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #49627b;
}

.hero h1 {
  font-size: clamp(1.2rem, 3.4vw, 1.95rem);
  line-height: 1.15;
  margin-top: 0.3rem;
  font-weight: 800;
}

.subtitle {
  margin-top: 0.3rem;
  color: #3d556c;
  max-width: 70ch;
}

.menu-open-btn {
  border: 1px solid #b5cbdf;
  border-radius: 0.62rem;
  background: #ffffff;
  color: #17344d;
  font-weight: 700;
  width: fit-content;
  padding: 0.55rem 0.85rem;
  cursor: pointer;
}

.layout-grid {
  display: grid;
  grid-template-columns: minmax(340px, 1fr);
  gap: 1rem;
  align-items: start;
}

.search-panel {
  border: 1px solid #d4e2ef;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.86);
  padding: 0.55rem;
}

.primary-btn {
  border: 0;
  border-radius: 0.7rem;
  background: #f4d54b;
  color: #132031;
  font-weight: 700;
  padding: 0.65rem 1rem;
  cursor: pointer;
}

.primary-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-banner {
  border: 1px solid #fecaca;
  background: #fff1f1;
  color: #9f1239;
  border-radius: 0.65rem;
  padding: 0.6rem 0.75rem;
}

.deck-dock {
  position: fixed;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  z-index: 55;
  width: min(1200px, calc(100vw - 1rem));
}

.pdf-dock {
  position: fixed;
  left: 50%;
  bottom: 0.85rem;
  transform: translateX(-50%);
  z-index: 60;
}

.pdf-dock-btn {
  min-width: 280px;
  box-shadow: 0 24px 44px rgba(10, 24, 40, 0.26);
}

.empty-state {
  border: 1px dashed #bfd0df;
  border-radius: 0.8rem;
  background: #f6fafe;
  color: #3b5872;
  padding: 0.85rem;
}

@media (max-width: 1240px) {
  .pdf-dock-btn {
    min-width: 250px;
  }
}

@media (max-width: 900px) {
  .deck-dock {
    width: calc(100vw - 1rem);
  }

  .pdf-dock {
    left: 50%;
    right: auto;
    bottom: 0.5rem;
    transform: translateX(-50%);
  }

  .pdf-dock-btn {
    min-width: 250px;
  }
}

@media (max-width: 800px) {
  .print-page {
    padding: 0.75rem;
  }

  .primary-btn {
    width: 100%;
  }
}

@media print {
  .print-page {
    background: #ffffff;
    padding: 0;
  }
}

@page {
  size: A4 landscape;
  margin: 0;
}
</style>
