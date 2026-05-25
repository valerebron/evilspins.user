<template>
  <Card v-if="card" :key="card?.slug" :card="card" :isRandom="true" />
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
