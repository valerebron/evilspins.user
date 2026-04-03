<template>
  <section class="deck">
    <PlayingCard :card :isFaceUp />
  </section>
</template>

<script setup lang="ts">
import type { Card } from '~~/types/types'

const isFaceUp = ref(false)
const route = useRoute()
const slug = route.params.slug as string
const { data: card, pending, error } = await useFetch<Card>(`/api/card/${slug}`)

useHead({
  title: computed(() =>
    card.value ? `${card.value.artist} - ${card.value.title}` : 'Loading...'
  )
})

onMounted(() => {
  setTimeout(() => {
    isFaceUp.value = true
  }, 700)
})
</script>

<style lang="scss" scoped>
.deck {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  min-height: 100vh;

  .playing-card {
    margin: 1rem;
  }
}
</style>
