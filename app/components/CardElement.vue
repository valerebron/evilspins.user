<template>
  <article :role="props.role" :class="[
    'card-element cursor-pointer',
    isFaceUp ? 'face-up' : 'face-down'
  ]" :tabindex="props.tabindex" :aria-disabled="false" @click="$emit('click', $event)"
    @keydown.enter="$emit('click', $event)">
    <div class="flip-inner" ref="cardElement">
      <!-- Face-Up -->
      <main
        class="face-up z-10 p-[6%] hover:shadow-xl hover:scale-110 transition-all shadow-lg flex flex-col overflow-hidden border-2">

        <Rank :card="props.card" />

        <!-- Cover -->
        <figure class="cover">
          <PlayButton :is-loading="isLoading" />
          <UnLazyImage :src="props.card.url_image" alt="card cover" loading="lazy" :blurhash="props.card.blurhash"
            class="cover-image w-full h-full object-cover object-center" draggable="false" />
        </figure>

        <!-- Body -->
        <div
          class="card-body p-[6%] text-center bg-white rounded-b-xl opacity-0 -mt-16 hover:opacity-100 hover:-mt-0 transition-all duration-300">
          <h2 class="select-text text-sm text-neutral-500 first-letter:uppercase truncate">
            {{ props.card.title || 'title' }}
          </h2>
          <p class="select-text text-base text-neutral-800 font-bold capitalize truncate">
            {{ props.card.artist || 'artist' }}
          </p>
        </div>
      </main>

      <!-- Face-Down -->
      <footer
        class="face-down z-10 p-[6%] bg-opacity-10 bg-white rounded-2xl shadow-lg flex flex-col overflow-hidden select-none">
        <figure class="cover">
          <PlayButton :is-loading="isLoading" />
          <img src="/face-down.svg" class="cover-image" :style="{ backgroundColor: cardColor }" draggable="false" />
        </figure>
      </footer>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { Card } from '~~/types/types'

const emit = defineEmits(['click'])

const props = withDefaults(defineProps<{
  card: Card;
  isFaceUp?: boolean;
  isLoading?: boolean;
  role?: string;
  tabindex?: string | number;
}>(), {
  isFaceUp: false,
  role: 'button',
  tabindex: '0'
})

import { getYearColor } from '~/utils/colors'

const cardColor = computed(() => getYearColor(props.card.year || 0))
</script>

<style lang="scss">
.card-element {
  perspective: 1000px;
  @apply transition-all scale-100 size-full;

  .flip-inner {
    position: relative;
    width: 100%;
    height: 100%;
    transition: transform 0.6s;
    transform-style: preserve-3d;
    transform-origin: center;
  }

  .face-down,
  .face-up {
    position: absolute;
    width: 100%;
    height: 100%;
    backface-visibility: hidden;
    will-change: transform;
    background-color: rgba(255, 255, 255, 0.5);

    .cover {
      @apply flex-1 flex justify-center items-center overflow-hidden cursor-pointer;

      border-radius: 0.75rem;
    }
  }

  .face-up {
    border-radius: 1rem;
    border: none;
    transform: rotateY(0deg);
    transition: box-shadow 0.6s;
  }

  .face-down {
    img {
      width: 100%;
    }

    figure {
      overflow: hidden;
    }
  }

  .face-down {
    transform: rotateY(-180deg);
  }

  &.face-down .flip-inner {
    transform: rotateY(180deg);
  }

  &.face-up .flip-inner {
    transform: rotateY(0deg);
  }

  &.face-down:hover {
    .play-button {
      opacity: 1;
    }

    .flip-inner {
      transform: rotateY(170deg);
    }
  }

  &:focus,
  &.current-card {
    @apply z-50 scale-110;
    outline: none;

    .face-up {
      @apply shadow-2xl;
      transition:
        box-shadow 0.6s,
        transform 6s;
    }
  }

  &:focus,
  &.current-card {
    .play-button {
      @apply opacity-100;
    }
  }

  .face-up {

    &:hover {
      .play-button {
        opacity: 1;
      }
    }

    .flip-inner {
      transform: rotateY(-170deg);
    }

    &.is-dragging {
      opacity: 0.65;
      transform: scale(0.92) rotate(5deg) !important;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
      z-index: 9999;
      cursor: grabbing !important;

      .play-button,
      .card-body {
        display: none !important;
      }
    }
  }

  .play-button {
    @apply absolute opacity-0 hover:opacity-100;
  }

  .cover-image:active,
  .face-down:active {
    .play-button {
      @apply scale-90;
    }
  }
}
</style>