<template>
  <div class="search-container">
    <div class="search-bar">
      <input v-model="searchQuery" type="text" placeholder="Rechercher par titre ou artiste..." class="search-input" />
    </div>

    <div class="filters">
      <div class="filter-group">
        <label for="suit-filter">Suit:</label>
        <select id="suit-filter" v-model="selectedSuit" class="filter-select">
          <option value="">Tous</option>
          <option v-for="suit in suits" :key="suit" :value="suit">{{ suit }}</option>
        </select>
      </div>

      <div class="filter-group">
        <label for="rank-filter">Rank:</label>
        <select id="rank-filter" v-model="selectedRank" class="filter-select">
          <option value="">Tous</option>
          <option v-for="rank in ranks" :key="rank" :value="rank">{{ rank }}</option>
        </select>
      </div>

      <div class="filter-group">
        <label for="year-filter">Year:</label>
        <select id="year-filter" v-model="selectedYear" class="filter-select">
          <option value="">Tous</option>
          <option v-for="year in availableYears" :key="year" :value="year">{{ year }}</option>
        </select>
      </div>

      <button @click="resetFilters" class="reset-btn">Réinitialiser</button>
    </div>

    <div class="results-count">
      {{ filteredCards.length }} résultat(s)
    </div>

    <div class="cards-grid">
      <Card v-for="card in filteredCards" :key="card.esid" :card="card" :is-face-up="true" :image-loading-type="'lazy'"
        :navigate-on-click="true" />
    </div>

    <div v-if="filteredCards.length === 0" class="no-results">
      Aucun résultat trouvé
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Card } from '~~/types/types'
import type { Suit, Rank } from '~~/types/types'

const { data: response, pending } = await useFetch<{ data: Card[] }>('/api/card')
const cards = computed(() => response.value?.data || [])

const searchQuery = ref('')
const selectedSuit = ref<Suit | ''>('')
const selectedRank = ref<Rank | ''>('')
const selectedYear = ref<number | ''>('')

const suits: Suit[] = ['♠', '♣', '♦', '♥']
const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'V', 'D', 'R']

const availableYears = computed(() => {
  if (!cards.value) return []
  const years = [...new Set(cards.value.map(card => card.year))].sort((a, b) => b - a)
  return years
})

const filteredCards = computed(() => {
  if (!cards.value) return []

  return cards.value.filter(card => {
    // Full-text search by title and artist
    const matchesSearch = !searchQuery.value ||
      card.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      card.artist.toLowerCase().includes(searchQuery.value.toLowerCase())

    // Filter by suit
    const matchesSuit = !selectedSuit.value || card.suit === selectedSuit.value

    // Filter by rank
    const matchesRank = !selectedRank.value || card.rank === selectedRank.value

    // Filter by year
    const matchesYear = !selectedYear.value || card.year === selectedYear.value

    return matchesSearch && matchesSuit && matchesRank && matchesYear
  })
})

const resetFilters = () => {
  searchQuery.value = ''
  selectedSuit.value = ''
  selectedRank.value = ''
  selectedYear.value = ''
}
</script>

<style scoped lang="scss">
.search-container {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.search-bar {
  margin-bottom: 1.5rem;
}

.search-input {
  width: 100%;
  padding: 1rem;
  font-size: 1.1rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  background: white;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: #fbbf24;
  }
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.5rem;
  align-items: center;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filter-group label {
  font-weight: 600;
  color: #374151;
}

.filter-select {
  padding: 0.5rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.375rem;
  background: white;
  font-size: 1rem;
  cursor: pointer;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: #fbbf24;
  }
}

.reset-btn {
  padding: 0.5rem 1rem;
  background: #fbbf24;
  border: none;
  border-radius: 0.375rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #f59e0b;
  }
}

.results-count {
  margin-bottom: 1rem;
  font-weight: 600;
  color: #6b7280;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
  align-items: center;
}

.no-results {
  text-align: center;
  padding: 3rem;
  font-size: 1.2rem;
  color: #6b7280;
}
</style>
