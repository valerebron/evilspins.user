<template>
  <Card v-if="card" :card="card" :is-face-up="isFaceUp" :autoplay="autoplay" class="slug" />
</template>

<script setup lang="ts">
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

<style lang="scss">
.slug .card-element .face-up .play-button {
  opacity: 1;
}

.slug .card-element .face-up:hover .play-button {
  transform: scale(1.2);
}
</style>
