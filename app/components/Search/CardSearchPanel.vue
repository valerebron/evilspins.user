<template>
  <div v-if="isVisible" :class="[
    'card-search-panel',
    `card-search-panel--${mode}`,
  ]" @click.self="handleBackdropClick">
    <section class="card-search-panel__surface" role="dialog" :aria-modal="isModalLike ? 'true' : 'false'">
      <header class="card-search-panel__header">
        <div>
          <h2 class="card-search-panel__title">{{ title }}</h2>
          <p class="card-search-panel__subtitle">{{ totalItems }} carte(s) trouvee(s)</p>
        </div>

        <button v-if="isModalLike" type="button" class="card-search-panel__close" @click="$emit('close')">
          Fermer
        </button>
      </header>

      <div class="card-search-panel__controls">
        <label for="card-search-query" class="sr-only">Rechercher une carte</label>
        <input id="card-search-query" ref="queryInput" v-model="searchInput" type="search"
          class="card-search-panel__input" placeholder="Rechercher par titre, artiste, slug" />

        <div class="card-search-panel__suits" role="group" aria-label="Filtrer par suit">
          <button v-for="suit in suits" :key="suit" type="button" class="suit-button"
            :class="{ 'suit-button--active': selectedSuit === suit }" @click="toggleSuit(suit)">
            {{ suit }}
          </button>
        </div>

        <label class="card-search-panel__year-filter">
          Year
          <select v-model="selectedYearInput">
            <option value="">Toutes</option>
            <option v-for="year in yearOptions" :key="year" :value="String(year)">{{ year }}</option>
          </select>
        </label>

        <button type="button" class="card-search-panel__reset" @click="resetFilters">Reset</button>
      </div>

      <p v-if="nfcStatus" class="card-search-panel__status" :class="{
        'card-search-panel__status--error': nfcStatusTone === 'error',
        'card-search-panel__status--success': nfcStatusTone === 'success',
      }">
        {{ nfcStatus }}
      </p>
      <p v-else-if="!canWriteNfc" class="card-search-panel__status">
        NFC: indisponible dans ce contexte (HTTPS et navigateur compatible requis).
      </p>

      <p v-if="pending" class="card-search-panel__status">Chargement...</p>
      <p v-else-if="errorMessage" class="card-search-panel__status card-search-panel__status--error">{{ errorMessage }}
      </p>

      <ul class="card-search-panel__results">
        <li v-for="card in cards" :key="card.slug || card.esid" class="card-search-panel__item">
          <article class="card-result" :class="{ 'card-result--selected': selectedSlug === card.slug }">
            <div class="card-result__playable">
              <Card :card="card" :show-play-button="true" :is-face-up="true" />
            </div>

            <div class="card-result__content">
              <div class="card-result__meta">
                <p class="card-result__title">{{ card.title }}</p>
                <p class="card-result__artist">{{ card.artist }}</p>
                <p class="card-result__chips">{{ card.rank || '?' }} {{ card.suit || '♠' }} · {{ card.year || '-' }}</p>
              </div>

              <div class="card-result__actions">
                <button type="button" class="card-result__pick" @click="onSelect(card)">
                  {{ pickLabel }}
                </button>

                <button type="button" class="card-result__nfc"
                  :disabled="writingNfcId === getCardId(card) || !canWriteNfc" @click="writeCardToNfc(card)">
                  {{ writingNfcId === getCardId(card) ? 'Ecriture NFC...' : 'Ecrire NFC' }}
                </button>
              </div>
            </div>
          </article>
        </li>
      </ul>

      <footer class="card-search-panel__footer">
        <button type="button" class="pager" :disabled="page <= 1" @click="page -= 1">Prec.</button>
        <span>Page {{ page }} / {{ totalPages }}</span>
        <button type="button" class="pager" :disabled="page >= totalPages" @click="page += 1">Suiv.</button>
      </footer>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { Card, Suit } from '~~/types/types'

const props = withDefaults(
  defineProps<{
    mode?: 'embedded' | 'modal' | 'fullscreen'
    open?: boolean
    title?: string
    pageSize?: number
    selectedSlug?: string | null
    autoFocus?: boolean
    pickLabel?: string
    closeOnSelect?: boolean
  }>(),
  {
    mode: 'embedded',
    open: true,
    title: 'Recherche de cartes',
    pageSize: 24,
    selectedSlug: null,
    autoFocus: true,
    pickLabel: 'Choisir',
    closeOnSelect: false,
  },
)

const emit = defineEmits<{
  select: [card: Card]
  close: []
}>()

const queryInput = ref<HTMLInputElement | null>(null)

const cards = ref<Card[]>([])
const pending = ref(false)
const errorMessage = ref('')

const page = ref(1)
const totalPages = ref(1)
const totalItems = ref(0)

const searchInput = ref('')
const searchQuery = ref('')
const selectedSuit = ref<Suit | ''>('')
const selectedYear = ref<number | null>(null)

const suits: Suit[] = ['♠', '♣', '♦', '♥']

const yearOptions = computed(() => {
  const currentYear = new Date().getFullYear()
  const minYear = 1900
  const result: number[] = []
  for (let year = currentYear; year >= minYear; year -= 1) {
    result.push(year)
  }
  return result
})

const selectedYearInput = computed({
  get: () => (selectedYear.value === null ? '' : String(selectedYear.value)),
  set: (value: string) => {
    selectedYear.value = value ? Number(value) : null
  },
})

const writingNfcId = ref<string | null>(null)
const nfcStatus = ref('')
const nfcStatusTone = ref<'success' | 'error' | ''>('')

const canWriteNfc = computed(() => {
  if (typeof window === 'undefined') {
    return false
  }
  return window.isSecureContext && 'NDEFReader' in window
})

let searchDebounce: ReturnType<typeof setTimeout> | null = null

const isVisible = computed(() => {
  if (props.mode === 'embedded' || props.mode === 'fullscreen') {
    return true
  }
  return props.open
})

const isModalLike = computed(() => props.mode === 'modal' || props.mode === 'fullscreen')

const loadCards = async () => {
  pending.value = true
  errorMessage.value = ''

  try {
    const response = await $fetch<{
      data: Card[]
      pagination?: {
        total?: number
        totalPages?: number
      }
    }>('/api/card', {
      params: {
        page: page.value,
        limit: props.pageSize,
        search: searchQuery.value.trim() || undefined,
        suit: selectedSuit.value || undefined,
        year: selectedYear.value || undefined,
      },
    })

    cards.value = response.data || []
    totalItems.value = response.pagination?.total || cards.value.length
    totalPages.value = Math.max(1, response.pagination?.totalPages || 1)
  } catch (error) {
    cards.value = []
    totalItems.value = 0
    totalPages.value = 1
    errorMessage.value = 'Impossible de charger les cartes.'
    console.error('CardSearchPanel error', error)
  } finally {
    pending.value = false
  }
}

watch(searchInput, (value) => {
  if (searchDebounce) {
    clearTimeout(searchDebounce)
  }

  searchDebounce = setTimeout(() => {
    page.value = 1
    searchQuery.value = value.trim()
  }, 220)
})

watch([searchQuery, selectedSuit, selectedYear], () => {
  page.value = 1
})

watch([page, searchQuery, selectedSuit, selectedYear, () => props.pageSize], () => {
  void loadCards()
}, { immediate: true })

watch(() => props.open, async (value) => {
  if (!value || !props.autoFocus) {
    return
  }
  await nextTick()
  queryInput.value?.focus()
}, { immediate: true })

const resetFilters = () => {
  searchInput.value = ''
  searchQuery.value = ''
  selectedSuit.value = ''
  selectedYear.value = null
  page.value = 1
}

const toggleSuit = (suit: Suit) => {
  selectedSuit.value = selectedSuit.value === suit ? '' : suit
}

const getCardId = (card: Card) => card.slug || card.esid

const getCardUrl = (card: Card) => {
  const relative = card.slug ? `/card/${card.slug}` : card.url_audio
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

const writeCardToNfc = async (card: Card) => {
  nfcStatus.value = ''
  nfcStatusTone.value = ''

  if (!canWriteNfc.value || typeof window === 'undefined') {
    nfcStatusTone.value = 'error'
    nfcStatus.value = 'Web NFC indisponible (HTTPS + Chrome Android requis).'
    return
  }

  const NdefReader = (window as Window & {
    NDEFReader?: new () => { write: (message: unknown) => Promise<void> }
  }).NDEFReader

  if (!NdefReader) {
    nfcStatusTone.value = 'error'
    nfcStatus.value = 'NDEFReader indisponible dans ce navigateur.'
    return
  }

  const cardId = getCardId(card)
  const cardUrl = getCardUrl(card)
  writingNfcId.value = cardId

  try {
    const writer = new NdefReader()
    await writer.write({
      records: [{
        recordType: 'url',
        data: cardUrl,
      }],
    })

    nfcStatusTone.value = 'success'
    nfcStatus.value = `Tag NFC ecrit: ${card.title}`
  } catch (error) {
    nfcStatusTone.value = 'error'
    nfcStatus.value = getNfcErrorMessage(error)
    console.error('CardSearchPanel NFC error', error)
  } finally {
    writingNfcId.value = null
  }
}

const handleBackdropClick = () => {
  if (props.mode === 'modal') {
    emit('close')
  }
}

const onSelect = (card: Card) => {
  emit('select', card)
  if (props.closeOnSelect) {
    emit('close')
  }
}

onBeforeUnmount(() => {
  if (searchDebounce) {
    clearTimeout(searchDebounce)
  }
})
</script>

<style scoped lang="scss">
.card-search-panel {
  width: 100%;
}

.card-search-panel--fullscreen,
.card-search-panel--modal {
  position: fixed;
  inset: 0;
  z-index: 70;
  padding: 2rem;
  background: rgba(5, 10, 18, 0.72);
  backdrop-filter: blur(4px);
}

.card-search-panel--fullscreen {
  padding: 1rem;
}

.card-search-panel__surface {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  border-radius: 1rem;
  background: #081626;
  color: #eff5fb;
  display: grid;
  gap: 0.8rem;
  padding: 1rem;
}

.card-search-panel--fullscreen .card-search-panel__surface {
  height: calc(100vh - 2rem);
  max-width: none;
}

.card-search-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
}

.card-search-panel__title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
}

.card-search-panel__subtitle {
  margin: 0.15rem 0 0;
  color: #bfd4e8;
  font-size: 0.9rem;
}

.card-search-panel__close,
.card-search-panel__reset,
.pager,
.card-result__pick,
.card-result__nfc,
.suit-button {
  border: 0;
  background: #0b1f35;
  color: #eff5fb;
  border-radius: 0.55rem;
  padding: 0.45rem 0.75rem;
  cursor: pointer;
}

.card-search-panel__controls {
  display: grid;
  gap: 0.65rem;
  grid-template-columns: minmax(220px, 1fr) auto minmax(110px, 170px) auto;
}

.card-search-panel__year-filter {
  display: grid;
  gap: 0.3rem;
  font-size: 0.82rem;
  color: #cce2f4;
}

.card-search-panel__controls input,
.card-search-panel__controls select {
  border: 0;
  background: #071321;
  color: #f8fcff;
  border-radius: 0.55rem;
  padding: 0.55rem 0.65rem;
}

.card-search-panel__suits {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.suit-button {
  min-width: 2.4rem;
  background: #0a1a2c;
}

.suit-button--active {
  background: #17385b;
  color: #ffffff;
}

.card-search-panel__status {
  margin: 0;
  font-size: 0.9rem;
  color: #c8dcec;
}

.card-search-panel__status--error {
  color: #fda4af;
}

.card-search-panel__status--success {
  color: #86efac;
}

.card-search-panel__results {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.9rem;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  max-height: min(65vh, 920px);
  overflow: auto;
}

.card-search-panel--fullscreen .card-search-panel__results {
  max-height: none;
}

.card-result {
  width: 100%;
  background: #06111f;
  border-radius: 0.75rem;
  padding: 0.7rem;
  display: grid;
  gap: 0.75rem;
}

.card-result--selected {
  box-shadow: 0 0 0 2px rgba(245, 197, 66, 0.4) inset;
}

.card-result__playable {
  width: 100%;
  max-width: 16rem;
  aspect-ratio: 7/10;
  margin: 0 auto;
}

.card-result__playable :deep(main.face-up),
.card-result__playable :deep(.face-up),
.card-result__playable :deep(.face-down) {
  border: 0 !important;
}

.card-result__content {
  display: grid;
  gap: 0.65rem;
}

.card-result__meta {
  min-width: 0;
}

.card-result__title,
.card-result__artist {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-result__title {
  color: #f8fcff;
  font-weight: 600;
}

.card-result__artist,
.card-result__chips {
  color: #c2d5e8;
  font-size: 0.83rem;
}

.card-result__chips {
  margin: 0.2rem 0 0;
}

.card-result__actions {
  display: flex;
  gap: 0.55rem;
  flex-wrap: wrap;
}

.card-result__nfc:disabled,
.pager:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.card-search-panel__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  color: #cbe1f5;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

@media (max-width: 1024px) {

  .card-search-panel--modal,
  .card-search-panel--fullscreen {
    padding: 0.6rem;
  }

  .card-search-panel--fullscreen .card-search-panel__surface {
    height: calc(100vh - 1.2rem);
  }

  .card-search-panel__controls {
    grid-template-columns: 1fr;
  }

  .card-search-panel__results {
    grid-template-columns: 1fr;
  }

  .card-result__playable {
    max-width: 13rem;
  }
}
</style>
