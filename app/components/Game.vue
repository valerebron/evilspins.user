<template>
  <div class="cards-container w-full" v-draggable="[cards]">
    <Card v-for="card in cards" :card="card" :isRandom="true" showPlayButtonFaceUp />
  </div>
</template>

<script setup lang="ts">
import type { Card } from '~~/types/types'

const cards = ref<Card[]>([])

const loadCards = async () => {
  try {
    cards.value = await $fetch<Card[]>('/api/card')
  } catch (error) {
    console.error('Error loading card:', error)
  }
}

onMounted(async () => {
  await loadCards()
})
</script>

<style scoped>
.cards-container {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  padding: 30px;
  max-width: 800px;
}
</style>
