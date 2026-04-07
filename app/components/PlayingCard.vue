<template>
  <section class="playing-card text-center" :class="{ 'open': isOpen }">
    <Card :card="props.card!" :is-face-up="isFaceUp" @click="clickOnCard" :role="isOpen ? 'img' : 'button'"
      :is-loading="isLoading" showPlayButtonFaceUp />
    <Platine v-if="isPlatineInit" ref="platineRef" :card="card" @loaded="onTrackLoaded" v-show="isOpen" />
    <Button v-if="isOpen" @click="closePlatine" key-alias="Escape" class="absolute top-0 right-0">Close</Button>
  </section>
</template>

<script setup lang="ts">
import type { Card } from '~~/types/types'
import { timeout } from '~/utils/timeout'

const props = defineProps<{
  card: Card,
  isRandom?: boolean
}>()

const isPlatineInit = ref(false)
const isOpen = ref(false)
const isFaceUp = ref(false)
const isLoading = ref(false)

const platineRef = useTemplateRef('platineRef')

const clickOnCard = () => {
  if (!isPlatineInit.value) {
    isPlatineInit.value = true
    isLoading.value = true
  } else {
    isOpen.value = true
    platineRef.value?.play()
  }
}

const onTrackLoaded = async () => {
  isFaceUp.value = true
  await timeout(700)
  isOpen.value = true
  const artist = props.card.artist ?? (props.card as any).name ?? 'Unknown Artist'
  document.title = `${artist} - ${props.card.title}`
  // Modifier l'URL seulement si ce n'est pas une carte aléatoire
  if (!props.isRandom) {
    window.history.pushState({}, '', `/card/${props.card.slug}`)
  }
  isLoading.value = false
  await timeout(500)
  platineRef.value?.play()
}

const closePlatine = () => {
  isOpen.value = false
  isPlatineInit.value = false
}
</script>

<style scoped lang="scss">
$open-speed: 0.4s;

.playing-card {
  @apply size-card;
  max-height: 100vmin;
  max-width: 100vmin;
  position: relative;
  transition: all $open-speed;

  .card,
  .platine {
    height: 100%;
    width: 100%;
    transition: max-width $open-speed, max-height $open-speed, transform 0.1s;
  }

  :deep(.card) {
    // transition: width $open-speed, height $open-speed, transform 0.1s;
    position: absolute;

    .face-up,
    .cover {
      transition: border-radius $open-speed, box-shadow $open-speed;

      &:active {
        .play-button {
          @apply scale-90;
        }
      }
    }
  }

  &.open {
    $open-size: 40rem;
    width: $open-size;
    height: $open-size;

    .card {
      pointer-events: none;

      &:focus {
        @apply z-auto scale-100;
      }
    }

    &:deep(.card) {

      .face-up,
      .face-down {
        border-radius: 100%;
        @apply shadow-xl;

        .cover {
          border-radius: 100%;
        }

        .rank,
        .play-button {
          opacity: 0;
        }
      }
    }
  }
}
</style>