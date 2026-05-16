<template>
  <Transition name="scale-in">
    <Card v-if="card" :card="card" :isRandom="true" />
  </Transition>
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

<style scoped>
.scale-in-enter-active {
  transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease-out;
}

.scale-in-enter-from {
  transform: scale(0);
  opacity: 0;
}

.scale-in-enter-to {
  transform: scale(1);
  opacity: 1;
}
</style>
