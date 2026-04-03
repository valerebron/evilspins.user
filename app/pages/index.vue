<template>
  <section class="deck">
    <PlayingCard v-for="(card, index) in card" :key="index" :card="card" />
  </section>
</template>

<script setup lang="ts">
import type { Card } from '~~/types/types'

const nbCard = 1
const card = ref<Card[]>([])

// Chargement des cartes
const loadCard = async () => {
  try {
    const promises = Array(nbCard).fill(0).map(() =>
      $fetch<Card>('/api/card/random')
    )
    const results = await Promise.all(promises)
    card.value = results
  } catch (error) {
    console.error('Error loading card:', error)
  }
}

onMounted(async () => {
  await loadCard()
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
