<template>
  <Card v-if="card" :card="card" :is-face-up="isFaceUp" :autoplay="autoplay" :show-play-button="showPlayButton" />
</template>

<script setup lang="ts">
const isFaceUp = ref(false)
const showPlayButton = ref(false)
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
    setTimeout(() => {
      showPlayButton.value = true
    }, 100)
  }, 700)
})
</script>
