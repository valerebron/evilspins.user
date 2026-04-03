<template>
  <div>
    <PlayingCard v-for="(card, index) in card" :key="index" :card="card" />
  </div>
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
