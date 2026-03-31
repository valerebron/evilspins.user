<template>
  <section class="deck">
    <PlatineCard v-for="(card, index) in cards" :key="index" :card="card" />
  </section>
</template>

<script setup lang="ts">
import type { Card } from '~~/types/types'

const nbCards = 1
const cards = ref<Card[]>([])

// Chargement des cartes
const loadCards = async () => {
  try {
    const promises = Array(nbCards).fill(0).map(() =>
      $fetch<Card>('/api/card/random')
    )
    const results = await Promise.all(promises)
    cards.value = results
  } catch (error) {
    console.error('Error loading cards:', error)
  }
}

onMounted(async () => {
  await loadCards()
})
</script>

<style lang="scss" scoped>
.deck {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  min-height: 100vh;

  .playing-card {
    margin: 1rem;
  }
}
</style>
