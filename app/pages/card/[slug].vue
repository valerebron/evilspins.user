<template>
  <div>
    <Card :card :isFaceUp />
  </div>
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
