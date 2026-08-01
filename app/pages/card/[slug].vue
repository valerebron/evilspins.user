<template>
  <Card v-if="card" :card="card" :is-face-up="isFaceUp" :autoplay="autoplay" :show-play-button="showPlayButton"
    click-behavior="self-play" />
</template>

<script setup lang="ts">
import { useSplashScreen } from '~/composables/useSplashScreen'

const isFaceUp = ref(false)
const showPlayButton = ref(false)
const route = useRoute()
const slug = route.params.slug as string
const autoplay = computed(() => route.query.autoplay === 'true')
const { data: card, pending, error } = await useFetch<Card>(`/api/card/${slug}`)
const { isSplashDone, waitForSplashDone } = useSplashScreen()

let flipTimeout: ReturnType<typeof setTimeout> | null = null
let showPlayButtonTimeout: ReturnType<typeof setTimeout> | null = null

useHead({
  title: computed(() =>
    card.value ? `${card.value.artist} - ${card.value.title}` : 'Loading...'
  )
})

onMounted(async () => {
  if (!isSplashDone.value) {
    await waitForSplashDone()
  }

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
