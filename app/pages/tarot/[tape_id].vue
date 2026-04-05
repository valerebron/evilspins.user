<template>
  <div v-for="card in tape_cards" :key="card.esid">
    <Card :card="card" :isFaceUp="true" showPlayButtonFaceUp />
  </div>
</template>

<script setup lang="ts">
import type { Card } from '~~/types/types'

const tape_cards = ref<Card[]>([])
const route = useRoute()
const tapeId = route.params.tape_id as string

onMounted(async () => {
  try {
    const data = await $fetch<Card[]>('/api/tarot/' + tapeId)
    tape_cards.value = Array.isArray(data) ? data : []
  } catch (error) {
    console.error('Error fetching tape cards:', error)
    tape_cards.value = []
  }
})
</script>

<style scoped>
.card {
  @apply size-card;
}
</style>