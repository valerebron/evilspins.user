<template>
  <section class="platine-card text-center" :class="{ 'platine-open': isPlatineOpen }">
    <Card :card="props.card!" :is-face-up="props.isFaceUp" @click="clickOnCard" :role="isPlatineOpen ? 'img' : 'button'"
      showPlayButtonFaceUp />
    <Platine v-if="isPlatineOpen && card" :card="card" autoplay/>
    <Button v-if="isPlatineOpen" @click="isPlatineOpen = false" key-alias="Escape">close</Button>
  </section>
</template>

<script setup lang="ts">
import type { Card } from '~~/types/types'

const props = defineProps<{ card: Card, isFaceUp: boolean }>()

const isPlatineOpen = ref(false)

const clickOnCard = () => {
  isPlatineOpen.value = !isPlatineOpen.value
}
</script>

<style scoped lang="scss">
$open-speed: 0.4s;

.platine-card {
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

  &.platine-open {
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
      .face-up, .face-down {
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