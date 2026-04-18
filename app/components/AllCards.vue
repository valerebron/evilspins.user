<template>
  <div class="game-container">
    <!-- Version SSR (sans draggable) -->
    <div v-if="!isClient" class="cards-container w-full">
      <Card v-for="card in cards" :card="card" :isRandom="true" showPlayButtonFaceUp />
    </div>

    <!-- Version client (avec draggable) -->
    <div v-else class="cards-container w-full" v-draggable="[cards]">
      <Card v-for="card in cards" :card="card" :isRandom="true" showPlayButtonFaceUp />
    </div>

    <!-- Loader pour l'infinite scroll -->
    <div ref="loadTrigger" class="load-trigger" v-if="hasMore && !isLoading">
      <div class="loader"></div>
    </div>

    <!-- Message de fin -->
    <div class="end-message" v-if="!hasMore && cards.length > 0">
      Toutes les cartes ont été chargées ({{ cards.length }} cartes)
    </div>

    <!-- Message d'erreur -->
    <div class="error-message" v-if="error">
      Erreur lors du chargement des cartes
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
const pageSize = ref(20) // Augmenté pour infinite scroll
const isClient = ref(false)
const isLoading = ref(false)
const hasMore = ref(true)
const error = ref<string | null>(null)
const loadTrigger = ref<HTMLElement | null>(null)

const loadCards = async (page: number = 1, append: boolean = false) => {
  if (isLoading.value || (!hasMore.value && page > 1)) return

  isLoading.value = true
  error.value = null

  try {
    const response = await $fetch<ApiResponse>(`/api/card?page=${page}&limit=${pageSize.value}`)

    if (append) {
      cards.value = [...cards.value, ...response.data]
    } else {
      cards.value = response.data
    }

    pagination.value = response.pagination
    currentPage.value = page
    hasMore.value = response.pagination.hasNext
  } catch (err) {
    console.error('Error loading cards:', err)
    error.value = 'Erreur lors du chargement'
  } finally {
    isLoading.value = false
  }
}

const loadMore = async () => {
  if (hasMore.value && !isLoading.value) {
    await loadCards(currentPage.value + 1, true)
  }
}

// Intersection Observer pour infinite scroll
const setupIntersectionObserver = () => {
  if (!loadTrigger.value) return

  const observer = new IntersectionObserver(
    (entries) => {
      const first = entries[0]
      if (first.isIntersecting && hasMore.value && !isLoading.value) {
        loadMore()
      }
    },
    { threshold: 0.1 }
  )

  observer.observe(loadTrigger.value)

  // Nettoyage
  return () => observer.disconnect()
}

onMounted(async () => {
  isClient.value = true
  await loadCards()

  // Setup intersection observer après le premier chargement
  nextTick(() => {
    setupIntersectionObserver()
  })
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

.load-trigger {
  display: flex;
  justify-content: center;
  padding: 40px 20px;
  width: 100%;
}

.loader {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.end-message {
  text-align: center;
  padding: 40px 20px;
  color: #6b7280;
  font-size: 14px;
  font-style: italic;
}

.error-message {
  text-align: center;
  padding: 20px;
  color: #ef4444;
  font-size: 14px;
  background-color: #fef2f2;
  border-radius: 6px;
  margin: 20px;
}

@media (max-width: 768px) {
  .cards-container {
    grid-template-columns: repeat(2, 1fr);
    gap: 15px;
    padding: 20px;
  }
}

@media (max-width: 480px) {
  .cards-container {
    grid-template-columns: 1fr;
    gap: 10px;
    padding: 15px;
  }
}
</style>
