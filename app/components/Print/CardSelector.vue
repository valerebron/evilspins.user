<template>
  <section class="selector" aria-labelledby="selector-title">
    <header class="selector-head">
      <h2 id="selector-title">Liste des cartes</h2>
      <div class="head-actions">
        <button
          type="button"
          class="display-toggle"
          :class="{ active: displayMode === 'grid' }"
          @click="$emit('update:displayMode', 'grid')"
        >
          Grille
        </button>
        <button
          type="button"
          class="display-toggle"
          :class="{ active: displayMode === 'list' }"
          @click="$emit('update:displayMode', 'list')"
        >
          Liste
        </button>
      </div>
    </header>

    <div class="search-row">
      <label for="print-search" class="sr-only">Rechercher une carte</label>
      <input
        id="print-search"
        :value="searchQuery"
        type="search"
        class="search-input"
        placeholder="Rechercher par titre, artiste ou mots-clés"
        @input="$emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
      />

      <label class="select-page">
        <input
          type="checkbox"
          :checked="allOnPageSelected"
          :disabled="cards.length === 0"
          @change="$emit('togglePage', ($event.target as HTMLInputElement).checked)"
        />
        Sélectionner la page
      </label>
    </div>

    <p class="status-row" v-if="pending">Chargement des cartes...</p>
    <p class="status-row error" v-else-if="errorMessage">{{ errorMessage }}</p>
    <p class="status-row" v-else>{{ totalItems }} carte(s) trouvée(s)</p>

    <ul :class="['cards', `mode-${displayMode}`]">
      <li v-for="card in cards" :key="card.slug" class="card-item">
        <label class="card-tile">
          <input
            type="checkbox"
            :checked="selectedSet.has(card.slug)"
            @change="$emit('toggleCard', card)"
          />

          <img :src="card.url_image" :alt="`Miniature ${card.title}`" class="thumb" loading="lazy" />

          <div class="meta">
            <p class="title">{{ card.title }}</p>
            <p class="artist">{{ card.artist }}</p>
            <p class="chips">
              <span class="chip">{{ card.rank || '?' }} {{ card.suit || '♠' }}</span>
              <span class="chip" v-if="card.year">{{ card.year }}</span>
            </p>
          </div>
        </label>
      </li>
    </ul>

    <footer class="pagination">
      <button type="button" class="pager" :disabled="page <= 1" @click="$emit('update:page', page - 1)">
        Prec.
      </button>
      <span class="page-indicator">Page {{ page }} / {{ totalPages }}</span>
      <button
        type="button"
        class="pager"
        :disabled="page >= totalPages"
        @click="$emit('update:page', page + 1)"
      >
        Suiv.
      </button>
    </footer>
  </section>
</template>

<script setup lang="ts">
import type { PrintCardItem } from '~/utils/print'

const props = withDefaults(
  defineProps<{
    cards: PrintCardItem[]
    pending: boolean
    errorMessage: string
    page: number
    totalPages: number
    totalItems: number
    searchQuery: string
    displayMode: 'grid' | 'list'
    selectedIds: string[]
  }>(),
  {
    cards: () => [],
    pending: false,
    errorMessage: '',
    page: 1,
    totalPages: 1,
    totalItems: 0,
    searchQuery: '',
    displayMode: 'grid',
    selectedIds: () => [],
  },
)

defineEmits<{
  'update:searchQuery': [value: string]
  'update:displayMode': [value: 'grid' | 'list']
  'update:page': [value: number]
  toggleCard: [card: PrintCardItem]
  togglePage: [checked: boolean]
}>()

const selectedSet = computed(() => new Set(props.selectedIds))

const allOnPageSelected = computed(() => {
  if (props.cards.length === 0) {
    return false
  }
  return props.cards.every((card) => selectedSet.value.has(card.slug))
})
</script>

<style scoped>
.selector {
  background: #091727;
  border: 1px solid #1f3448;
  border-radius: 1rem;
  padding: 1rem;
  color: #eff5fb;
  display: grid;
  gap: 0.9rem;
}

.selector-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.selector-head h2 {
  font-size: 1.05rem;
  font-weight: 700;
}

.head-actions {
  display: inline-flex;
  border: 1px solid #2a4660;
  border-radius: 0.6rem;
  overflow: hidden;
}

.display-toggle {
  border: 0;
  background: transparent;
  color: #cbe1f5;
  padding: 0.35rem 0.7rem;
  cursor: pointer;
}

.display-toggle.active {
  background: #12314f;
  color: #ffffff;
}

.search-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.search-input {
  min-width: 15rem;
  flex: 1;
  padding: 0.6rem 0.75rem;
  border-radius: 0.65rem;
  border: 1px solid #2c4a66;
  background: #08111f;
  color: #f7fbff;
}

.select-page {
  font-size: 0.9rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.status-row {
  font-size: 0.9rem;
  color: #bdd4ea;
}

.status-row.error {
  color: #fca5a5;
}

.cards {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.75rem;
  max-height: 56vh;
  overflow: auto;
}

.mode-grid {
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
}

.mode-list {
  grid-template-columns: 1fr;
}

.card-tile {
  width: 100%;
  display: grid;
  grid-template-columns: auto 62px 1fr;
  gap: 0.65rem;
  align-items: center;
  border: 1px solid #29435b;
  border-radius: 0.7rem;
  background: #071321;
  padding: 0.55rem;
  cursor: pointer;
}

.thumb {
  width: 62px;
  height: 40px;
  border-radius: 0.35rem;
  object-fit: cover;
}

.meta {
  min-width: 0;
}

.title,
.artist {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.title {
  color: #f7fbff;
  font-size: 0.9rem;
  font-weight: 600;
}

.artist {
  color: #c2d5e8;
  font-size: 0.82rem;
}

.chips {
  margin-top: 0.3rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.chip {
  background: #17344d;
  color: #d7e8f7;
  border-radius: 999px;
  font-size: 0.72rem;
  padding: 0.08rem 0.45rem;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.pager {
  border: 1px solid #355673;
  background: #0b1f35;
  color: #eff5fb;
  border-radius: 0.5rem;
  padding: 0.45rem 0.7rem;
  cursor: pointer;
}

.pager:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-indicator {
  font-size: 0.88rem;
  color: #bfd4e8;
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
</style>
