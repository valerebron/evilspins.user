<template>
  <PlayingCard v-for="(cardItem, index) in card" :key="index" :card="cardItem" :isRandom="true" />
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
