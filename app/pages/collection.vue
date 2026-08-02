<template>
  <article v-for="card in collectedCards" :key="card.slug || card.esid" class="collection-card">
    <Card :card="card" :is-face-up="true" :show-play-button="false" />
  </article>
</template>

<script setup lang="ts">
import type { Card as CardType } from '~~/types/types'

const { data, pending, error } = await useFetch<{
  data: CardType[]
}>('/api/card', {
  query: {
    limit: 500,
    page: 1,
  },
})

const cards = computed<CardType[]>(() => data.value?.data || [])
const { ensureLoaded, flippedSlugs } = usePersistentCardState()

const collectedCards = computed<CardType[]>(() => {
  if (flippedSlugs.value.size === 0) {
    return []
  }

  return cards.value.filter(card => {
    const slug = card.slug || ''
    return slug.length > 0 && flippedSlugs.value.has(slug)
  })
})

onMounted(() => {
  ensureLoaded()
})
</script>
