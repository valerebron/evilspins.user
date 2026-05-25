<template>
  <Card :card :is-face-up="isFaceUp" :autoplay="false" :showPlayButton="true" />
</template>

<script setup lang="ts">
import type { Card } from '~~/types/types'

definePageMeta({
  layout: 'list'
})

const isFaceUp = ref(false)
const route = useRoute()
const slug = route.params.slug as string
const autoplay = computed(() => route.query.autoplay === 'true')
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
