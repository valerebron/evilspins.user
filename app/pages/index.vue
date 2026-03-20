<template>
  <section class="deck">
    <PlatineCard v-for="(card, index) in cards" :key="index" :card="card" :isFaceUp="isFaceUp[index]"
      @click="isFaceUp[index] = true" />
  </section>
</template>

<script setup lang="ts">
import type { Card } from '~~/types/types'

const nbCards = 1
const cards = ref<Card[]>([])
const isFaceUp = ref<boolean[]>([])

// Chargement des cartes
const loadCards = async () => {
  try {
    const promises = Array(nbCards).fill(0).map(() =>
      $fetch<Card>('/api/card/random')
    )
    const results = await Promise.all(promises)
    cards.value = results
    isFaceUp.value = new Array(nbCards).fill(false)
  } catch (error) {
    console.error('Error loading cards:', error)
  }
}

// Animation de retournement des cartes
const flipCards = () => {
  isFaceUp.value.forEach((_, index) => {
    setTimeout(() => {
      isFaceUp.value[index] = false
    }, 400 * (index + 1))
  })
}

onMounted(async () => {
  await loadCards()
  setTimeout(flipCards, 600)
})

useHead({
  title: computed(() =>
    cards.value[0] ? `${cards.value[0].artist} - ${cards.value[0].title}` : 'Loading...'
  )
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
