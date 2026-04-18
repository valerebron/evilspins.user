<template>
  <div class="game-container">
    <div class="cards-container w-full" v-draggable="isClient ? [cards] : null">
      <Card v-for="card in cards" :card="card" :isRandom="true" showPlayButtonFaceUp />
    </div>

    <div class="pagination-controls" v-if="pagination">
      <button @click="loadPage(pagination.page - 1)" :disabled="!pagination.hasPrev" class="pagination-btn">
        Précédent
      </button>

      <span class="page-info">
        Page {{ pagination.page }} / {{ pagination.totalPages }}
        ({{ pagination.total }} cartes)
      </span>

      <button @click="loadPage(pagination.page + 1)" :disabled="!pagination.hasNext" class="pagination-btn">
        Suivant
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Card } from '~~/types/types'

interface PaginationResponse {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

interface ApiResponse {
  data: Card[]
  pagination: PaginationResponse
}

const cards = ref<Card[]>([])
const pagination = ref<PaginationResponse | null>(null)
const currentPage = ref(1)
const pageSize = ref(12)
const isClient = ref(false)

const loadCards = async (page: number = 1) => {
  try {
    const response = await $fetch<ApiResponse>(`/api/card?page=${page}&limit=${pageSize.value}`)
    cards.value = response.data
    pagination.value = response.pagination
    currentPage.value = page
  } catch (error) {
    console.error('Error loading cards:', error)
  }
}

const loadPage = (page: number) => {
  if (page >= 1 && pagination.value && page <= pagination.value.totalPages) {
    loadCards(page)
  }
}

onMounted(async () => {
  isClient.value = true
  await loadCards()
})
</script>

<style scoped>
.game-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.cards-container {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  padding: 30px;
  max-width: 800px;
  width: 100%;
}

.pagination-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 20px;
  width: 100%;
  max-width: 800px;
}

.pagination-btn {
  padding: 8px 16px;
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.pagination-btn:hover:not(:disabled) {
  background-color: #2563eb;
}

.pagination-btn:disabled {
  background-color: #9ca3af;
  cursor: not-allowed;
}

.page-info {
  font-size: 14px;
  color: #6b7280;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .cards-container {
    grid-template-columns: repeat(2, 1fr);
    gap: 15px;
    padding: 20px;
  }

  .pagination-controls {
    gap: 10px;
    padding: 15px;
  }
}

@media (max-width: 480px) {
  .cards-container {
    grid-template-columns: 1fr;
    gap: 10px;
    padding: 15px;
  }

  .pagination-controls {
    flex-direction: column;
    gap: 10px;
  }
}
</style>
