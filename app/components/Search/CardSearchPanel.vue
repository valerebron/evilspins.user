<template>
  <div v-if="isVisible" :class="[
    'card-search-panel',
    `card-search-panel--${mode}`,
  ]" @click.self="handleBackdropClick">
    <section ref="surfaceEl" class="card-search-panel__surface" role="dialog" :aria-modal="isModalLike ? 'true' : 'false'">
      <div class="card-search-panel__controls">
        <div class="card-search-panel__controls-row">
          <input id="card-search-query" ref="queryInput" v-model="searchInput" type="search"
            class="card-search-panel__input" placeholder="Rechercher" />
            <!-- <p class="card-search-panel__subtitle">{{ totalItems }}</p> -->

          <button type="button" class="card-search-panel__filters-toggle"
            :class="{ 'card-search-panel__filters-toggle--active': hasActiveFilters }"
            @click="filtersOpen = !filtersOpen">
            Filtres
            <span v-if="hasActiveFilters" class="card-search-panel__filters-badge">•</span>
            <span class="card-search-panel__filters-arrow">{{ filtersOpen ? '▲' : '▼' }}</span>
          </button>

        </div>

        <div v-show="filtersOpen" class="card-search-panel__filters-panel">
          <div class="card-search-panel__suits" role="group" aria-label="Filtrer par suit">
            <button v-for="suit in suits" :key="suit" type="button" class="suit-button"
              :class="{ 'suit-button--active': selectedSuit === suit }" @click="toggleSuit(suit)">
              {{ suit }}
            </button>
          </div>

          <label class="card-search-panel__year-filter">
            <select v-model="selectedYearInput">
              <option value="">Toutes années</option>
              <option v-for="year in yearOptions" :key="year" :value="String(year)">{{ year }}</option>
            </select>
          </label>

          <button type="button" class="card-search-panel__reset" @click="resetFilters">Reset</button>
        </div>
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

      <ul class="card-search-panel__results">        <li v-for="card in cards" :key="card.slug || card.esid" class="card-search-panel__item">
          <article class="card-result" :class="{ 'card-result--selected': selectedSlug === card.slug }">
            <div class="card-result__playable">
              <Card :card="card" :show-play-button="true" :is-face-up="true" />
            </div>

            <div class="card-result__content">
              <div class="card-result__actions">
                <div class="card-result__menu">
                  <button
                    type="button"
                    class="card-result__menu-toggle"
                    :aria-expanded="openMenuCardId === getCardId(card)"
                    @click.stop="openMenuCardId = openMenuCardId === getCardId(card) ? null : getCardId(card)"
                    :style="{ background: getYearColor(card.year) }"
                  >
                    •••
                  </button>
                  <div v-if="openMenuCardId === getCardId(card)" class="card-result__menu-panel" :style="{ background: getYearColor(card.year) }">
                    <button type="button" class="card-result__menu-item" @click="onSelect(card); openMenuCardId = null">
                      {{ pickLabel }}
                    </button>
                    <template v-if="canWriteNfc">
                      <button type="button" class="card-result__menu-item" :disabled="writingNfcId === getCardId(card)" @click="writeCardToNfc(card)">
                        {{ writingNfcId === getCardId(card) ? 'Ecriture...' : 'Ecrire NFC' }}
                      </button>
                      <button
                        type="button"
                        class="card-result__menu-item card-result__menu-item--lock"
                        :class="{ 'card-result__menu-item--lock-active': lockNfcAfterWrite }"
                        :title="lockNfcAfterWrite ? 'Verrouiller apres ecriture : actif' : 'Verrouiller apres ecriture : inactif'"
                        @click="lockNfcAfterWrite = !lockNfcAfterWrite"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="13" height="13" aria-hidden="true">
                          <path v-if="lockNfcAfterWrite" d="M12 1a5 5 0 0 0-5 5v3H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-2V6a5 5 0 0 0-5-5zm-3 5a3 3 0 1 1 6 0v3H9V6zm3 7a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" />
                          <path v-else d="M18 6a5 5 0 0 0-10 0v3H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-2V6zM10 6a2 2 0 1 1 4 0v3h-4V6zm2 7a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" />
                        </svg>
                        Verrouiller apres ecriture
                      </button>
                    </template>
                    <hr class="card-result__menu-divider" />
                    <div class="card-result__menu-header text-center">
                      <span class="card-result__menu-title">{{ card.title }}</span>
                      <span class="card-result__menu-artist">{{ card.artist }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </article>
        </li>
        <li v-if="pending" class="card-search-panel__sentinel-loader" aria-live="polite">
          Chargement...
        </li>
        <li v-else-if="hasMore" ref="sentinel" class="card-search-panel__sentinel" aria-hidden="true" />
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { Card, Suit } from '~~/types/types'
import { getYearColor } from '~/utils/colors'

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

const filtersOpen = ref(false)
const hasActiveFilters = computed(() => selectedSuit.value !== '' || selectedYear.value !== null)

const lockNfcAfterWrite = ref(false)

const openMenuCardId = ref<string | null>(null)

useOutsideClick(() => { openMenuCardId.value = null }, { exclude: ['.card-result__menu'] })

const writingNfcId = ref<string | null>(null)
const nfcStatus = ref('')
const nfcStatusTone = ref<'success' | 'error' | ''>('')

const canWriteNfc = computed(() => {
  if (typeof window === 'undefined') {
    return false
  }
  return window.isSecureContext && 'NDEFReader' in window || true
})

type WebNfcWriter = {
  write: (message: unknown) => Promise<void>
  makeReadOnly?: () => Promise<void>
}

let searchDebounce: ReturnType<typeof setTimeout> | null = null

const isVisible = computed(() => {
  if (props.mode === 'embedded' || props.mode === 'fullscreen') {
    return true
  }
  return props.open
})

const isModalLike = computed(() => props.mode === 'modal')

const loadCards = async (append = false) => {
  if (pending.value) return
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

    const newCards = response.data || []
    cards.value = append ? [...cards.value, ...newCards] : newCards
    totalItems.value = response.pagination?.total || cards.value.length
    totalPages.value = Math.max(1, response.pagination?.totalPages || 1)
  } catch (error) {
    if (!append) cards.value = []
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
    searchQuery.value = value.trim()
  }, 220)
})

watch([searchQuery, selectedSuit, selectedYear, () => props.pageSize], () => {
  cards.value = []
  page.value = 1
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
    NDEFReader?: new () => WebNfcWriter
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

    if (lockNfcAfterWrite.value) {
      if (typeof writer.makeReadOnly !== 'function') {
        throw new Error('makeReadOnly() indisponible dans ce navigateur.')
      }

      await writer.makeReadOnly()
    }

    nfcStatusTone.value = 'success'
    nfcStatus.value = lockNfcAfterWrite.value
      ? `Tag NFC ecrit et verrouille: ${card.title}`
      : `Tag NFC ecrit: ${card.title}`
  } catch (error) {
    nfcStatusTone.value = 'error'
    nfcStatus.value = getNfcErrorMessage(error)
    console.error('CardSearchPanel NFC error', error)
  } finally {
    writingNfcId.value = null
  }
}

const surfaceEl = ref<HTMLElement | null>(null)
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

const hasMore = computed(() => page.value < totalPages.value)

const loadMore = () => {
  if (pending.value || !hasMore.value) return
  page.value += 1
  void loadCards(true)
}

watch(sentinel, (el) => {
  observer?.disconnect()
  if (!el) return
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) loadMore()
    },
    { root: isModalLike.value ? surfaceEl.value : null, threshold: 0 },
  )
  observer.observe(el)
})

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
  observer?.disconnect()
  if (searchDebounce) {
    clearTimeout(searchDebounce)
  }
})
</script>

<style scoped lang="scss">
.card-search-panel {
  width: 100%;
}

.card {
  width: 100%;
}

.card-search-panel--modal {
  position: fixed;
  inset: 0;
  z-index: 70;
  padding: 2rem;
  backdrop-filter: blur(4px);
}

.card-search-panel__surface {
  width: 100%;
  margin: 0 auto;
  color: #eff5fb;
  display: grid;
  gap: 0.8rem;
}

.card-search-panel--modal .card-search-panel__surface {
  max-width: none;
  height: 100%;
  overflow-y: auto;
  padding: 1rem;
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
.suit-button {
  border: 0;
  color: #eff5fb;
  border-radius: 0.55rem;
  padding: 0.45rem 0.75rem;
  cursor: pointer;
}

.card-search-panel__controls {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  position: sticky;
  top: 0;
  z-index: 10;
  backdrop-filter: blur(6px);
  padding: 0.6rem 0;
  margin: -0.6rem 0 0;
}

.card-search-panel__controls-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.card-search-panel__controls-row .card-search-panel__input {
  flex: 1;
  min-width: 0;
}

.card-search-panel__filters-toggle {
  border: 0;
  background: #0b1f35;
  color: #eff5fb;
  border-radius: 0.55rem;
  padding: 0.45rem 0.75rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  white-space: nowrap;
}

.card-search-panel__filters-toggle--active {
  background: #17385b;
}

.card-search-panel__filters-badge {
  color: #60a5fa;
  font-size: 1.1rem;
  line-height: 1;
}

.card-search-panel__filters-arrow {
  font-size: 0.7rem;
  opacity: 0.7;
}

.card-search-panel__filters-panel {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-wrap: wrap;
  padding: 0.5rem 0.6rem;
  background: #071321;
  border-radius: 0.55rem;
}

.card-search-panel__year-filter {
  display: grid;
  gap: 0.3rem;
  font-size: 0.82rem;
  color: #cce2f4;
}

.card-result__nfc-group {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.card-result__nfc-lock {
  border: 0;
  background: #0b1f35;
  color: #6b8fa8;
  border-radius: 0.6rem;
  padding: 0.6rem 0.6rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.card-result__nfc-lock--active {
  color: #60a5fa;
  background: #0f2a44;
}

.card-result__menu {
  position: relative;
}

.card-result__menu-toggle {
    // transform: rotate(90deg);
  transform-origin: center;
  height: 2.3rem;
  border: 0;
  background: #0b1f35;
  color: #eff5fb;
  border-radius: 0.55rem;
  padding: 0.35rem 0.65rem;
  cursor: pointer;
  font-size: 0.8rem;
  letter-spacing: 0.05em;
  line-height: 1;

}

.card-result__menu-panel {
  position: absolute;
  bottom: calc(100% + 0.4rem);
  right: 0;
  z-index: 20;
  background: #0d2035;
  border-radius: 0.6rem;
  padding: 0.3rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 11rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

.card-result__menu-header {
  padding: 0.5rem 0.7rem 0.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.card-result__menu-title {
  font-size: 0.88rem;
  font-weight: 600;
  color: #f0f6ff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-result__menu-artist {
  font-size: 0.8rem;
  color: #f0f6ff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-radius: 999px;
}

.card-result__menu-year {
  display: inline-block;
  align-self: flex-start;
  margin-top: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #d0e8ff;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
}

.card-result__menu-divider {
  border: none;
  border-top: 1px solid #1a3450;
  margin: 0.1rem 0.4rem;
}

.card-result__menu-item {
  border: 0;
  background: transparent;
  color: #eff5fb;
  border-radius: 0.4rem;
  padding: 0.5rem 0.7rem;
  cursor: pointer;
  text-align: left;
  font-size: 0.88rem;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  white-space: nowrap;
}

.card-result__menu-item:hover {
  background: #162d46;
}

.card-result__menu-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.card-result__menu-item--lock {
  color: #8ab4d4;
}

.card-result__menu-item--lock-active {
  color: #60a5fa;
}

.card-search-panel__controls input,
.card-search-panel__controls select {
  border: 0;
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
}

.suit-button--active {
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
}

.card-result {
  position: relative;
  width: 100%;
  border-radius: 0.75rem;
  display: grid;
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
      position: absolute;
    bottom: 0;
    right: 0;
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
  justify-content: flex-end;
}

.card-search-panel__sentinel {
  height: 1px;
  grid-column: 1 / -1;
}

.card-search-panel__sentinel-loader {
  grid-column: 1 / -1;
  text-align: center;
  padding: 0.75rem 0;
  color: #8ab4d4;
  font-size: 0.88rem;
  list-style: none;
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
    max-width: none;
  }

  .card-search-panel__controls {
    grid-template-columns: 1fr;
  }

  .card-result__playable {
    max-width: 13rem;
  }
}
</style>
