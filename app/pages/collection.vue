<template>
  <article v-for="card in collectedCards" :key="card.slug || card.esid" class="collection-card">
    <Card :card="card" :is-face-up="true" :show-play-button="false" click-behavior="self-play" />
  </article>
  <CollectionActions class="fixed bottom-20" />
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

const cardAction = (payload: { button: string; card: CardType }) => {
  console.log(payload)
}

onMounted(() => {
  ensureLoaded()
})
</script>

<style scoped>
.collection-card .card {
  width: 160px;
}

.card.open {
  transform: scale(1.5);
  z-index: 10;
}
</style>