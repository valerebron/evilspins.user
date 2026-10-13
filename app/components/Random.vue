<template>
  <Card v-if="card" :key="card?.slug" :card="card" click-behavior="self-play" />
</template>

<script setup lang="ts">
import type { Card } from '~~/types/types'
const card = ref<Card | null>(null)
onMounted(async () => {
  card.value = await $fetch<Card>('/api/card/random')
})
</script>

<style scoped>
.card {
  width: 20vh;
}
</style>