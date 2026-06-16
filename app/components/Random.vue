<template>
  <Card v-if="card" :key="card?.slug" :card="card" />
</template>

<script setup lang="ts">
import type { Card } from '~~/types/types'
const card = ref<Card | null>(null)
onMounted(async () => {
  card.value = await $fetch<Card>('/api/card/random')
})
</script>
