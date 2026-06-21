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

        <label>
          Suit
          <select v-model="selectedSuit">
            <option value="">Tous</option>
            <option v-for="suit in suits" :key="suit" :value="suit">{{ suit }}</option>
          </select>
        </label>

        <label>
          Rank
          <select v-model="selectedRank">
            <option value="">Tous</option>
            <option v-for="rank in ranks" :key="rank" :value="rank">{{ rank }}</option>
          </select>
        </label>

        <label>
          Year
          <input v-model.number="selectedYear" type="number" min="1900" max="2099" placeholder="YYYY" />
        </label>

        <button type="button" class="card-search-panel__reset" @click="resetFilters">Reset</button>
      </div>

      <p v-if="pending" class="card-search-panel__status">Chargement...</p>
      <p v-else-if="errorMessage" class="card-search-panel__status card-search-panel__status--error">{{ errorMessage }}
      </p>

      <ul class="card-search-panel__results">
        <li v-for="card in cards" :key="card.slug || card.esid" class="card-search-panel__item">
          <article class="card-result" :class="{ 'card-result--selected': selectedSlug === card.slug }">
            <img :src="card.url_image" :alt="`Miniature ${card.title}`" loading="lazy" class="card-result__thumb" />

            <div class="card-result__meta">
              <p class="card-result__title">{{ card.title }}</p>
              <p class="card-result__artist">{{ card.artist }}</p>
              <p class="card-result__chips">{{ card.rank || '?' }} {{ card.suit || '♠' }} · {{ card.year || '-' }}</p>
            </div>

            <button type="button" class="card-result__pick" @click="onSelect(card)">
              {{ pickLabel }}
            </button>
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
import type { Card, Rank, Suit } from '~~/types/types'

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
const selectedRank = ref<Rank | ''>('')
const selectedYear = ref<number | null>(null)

const suits: Suit[] = ['♠', '♣', '♦', '♥']
const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'V', 'D', 'R']

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
        rank: selectedRank.value || undefined,
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

watch([searchQuery, selectedSuit, selectedRank, selectedYear], () => {
  page.value = 1
})

watch([page, searchQuery, selectedSuit, selectedRank, selectedYear, () => props.pageSize], () => {
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
  selectedRank.value = ''
  selectedYear.value = null
  page.value = 1
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
  border: 1px solid #273a4d;
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
.card-result__pick {
  border: 1px solid #355673;
  background: #0b1f35;
  color: #eff5fb;
  border-radius: 0.55rem;
  padding: 0.45rem 0.75rem;
  cursor: pointer;
}

.card-search-panel__controls {
  display: grid;
  gap: 0.65rem;
  grid-template-columns: minmax(220px, 1fr) repeat(3, minmax(90px, 140px)) auto;
}

.card-search-panel__controls label {
  display: grid;
  gap: 0.3rem;
  font-size: 0.82rem;
  color: #cce2f4;
}

.card-search-panel__controls input,
.card-search-panel__controls select {
  border: 1px solid #2d4c69;
  background: #071321;
  color: #f8fcff;
  border-radius: 0.55rem;
  padding: 0.55rem 0.65rem;
}

.card-search-panel__status {
  margin: 0;
  font-size: 0.9rem;
  color: #c8dcec;
}

.card-search-panel__status--error {
  color: #fda4af;
}

.card-search-panel__results {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.7rem;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  max-height: min(65vh, 920px);
  overflow: auto;
}

.card-search-panel--fullscreen .card-search-panel__results {
  max-height: none;
}

.card-result {
  width: 100%;
  border: 1px solid #28425a;
  background: #07111f;
  border-radius: 0.75rem;
  padding: 0.55rem;
  display: grid;
  grid-template-columns: 74px 1fr auto;
  align-items: center;
  gap: 0.65rem;
}

.card-result--selected {
  border-color: #f5c542;
  box-shadow: 0 0 0 1px rgba(245, 197, 66, 0.4) inset;
}

.card-result__thumb {
  width: 74px;
  height: 48px;
  border-radius: 0.35rem;
  object-fit: cover;
  background: #0f2134;
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

.card-search-panel__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  color: #cbe1f5;
}

.pager:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
    grid-template-columns: 1fr 1fr;
  }

  .card-search-panel__results {
    grid-template-columns: 1fr;
  }

  .card-result {
    grid-template-columns: 64px 1fr auto;
  }
}
</style>
