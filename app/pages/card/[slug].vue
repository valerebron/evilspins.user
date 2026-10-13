<template>
  <Card v-if="card" class="card-reveal" :class="{ 'is-visible': cardVisible }" :card="card" :is-face-up="isFaceUp"
    :autoplay="autoplay" :show-play-button="showPlayButton" click-behavior="self-play" />
</template>

<script setup lang="ts">
import type { Card } from '~~/types/types'

const cardVisible = ref(false)
const isFaceUp = ref(false)
const showPlayButton = ref(true)
const route = useRoute()
const slug = route.params.slug as string
const autoplay = computed(() => route.query.autoplay === 'true')
const { data: card, pending, error } = await useFetch<Card>(`/api/card/${slug}`)

let flipTimeout: ReturnType<typeof setTimeout> | null = null
let showPlayButtonTimeout: ReturnType<typeof setTimeout> | null = null

useHead({
  title: computed(() =>
    card.value ? `${card.value.artist} - ${card.value.title}` : 'Loading...'
  )
})

onMounted(async () => {
  requestAnimationFrame(() => {
    cardVisible.value = true
  })

  flipTimeout = setTimeout(() => {
    isFaceUp.value = true
    showPlayButtonTimeout = setTimeout(() => {
      showPlayButton.value = true
      showPlayButtonTimeout = null
    }, 100)
    flipTimeout = null
  }, 700)
})

onUnmounted(() => {
  if (flipTimeout) {
    clearTimeout(flipTimeout)
    flipTimeout = null
  }

  if (showPlayButtonTimeout) {
    clearTimeout(showPlayButtonTimeout)
    showPlayButtonTimeout = null
  }
})
</script>

<style lang="scss" scoped>
.card-reveal {
  opacity: 0;
  transform: translateY(24vh) scale(0.96);
}

.card-reveal.is-visible {
  animation: card-slide-up 650ms cubic-bezier(0.18, 0.8, 0.22, 1) forwards;
}

@keyframes card-slide-up {
  from {
    transform: translateY(24vh) scale(0.96);
    opacity: 0;
  }

  to {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}
</style>
