<template>
  <Card v-for="card in cards" :key="card.esid" :card="card" :is-face-up="true" :image-loading-type="'lazy'" />
</template>

<script setup lang="ts">
import type { Card } from '~~/types/types'

const { data: cards, pending, error } = await useFetch<Card[]>('/api/card')
</script>

<style scoped lang="scss">
.card {
  @apply w-80 m-4;
}
</style>