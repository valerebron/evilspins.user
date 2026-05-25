<template>
  <Transition name="scale-in" mode="out-in" appear>
    <Card v-if="card" :key="card?.slug" :card="card" :isRandom="true" />
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
.scale-in-enter-active,
.scale-in-leave-active {
  transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease-out;
}

.scale-in-enter-from,
.scale-in-leave-to {
  transform: scale(0);
  opacity: 0;
}

.scale-in-enter-to,
.scale-in-leave-from {
  transform: scale(1);
  opacity: 1;
}
</style>
