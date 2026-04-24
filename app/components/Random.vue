<template>
  <Card v-if="card" :card="card" :isRandom="true" showPlayButtonFaceUp />
</template>

<script setup lang="ts">
import type { Card } from '~~/types/types'

const card = ref<Card | null>(null)

// Chargement de la carte
const loadCard = async () => {
  try {
    card.value = await $fetch<Card>('/api/card/random')
  } catch (error) {
    console.error('Error loading card:', error)
  }
}

onMounted(async () => {
  await loadCard()
})
</script>
