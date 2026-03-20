<template>
  <article :role="props.role" :class="[
    'card cursor-pointer',
    isFaceUp ? 'face-up' : 'face-down',
    showPlayButtonFaceUp ? 'show-play-button-face-up' : ''
  ]" :tabindex="props.tabindex" :aria-disabled="false" @click="$emit('click', $event)"
    @keydown.enter="$emit('click', $event)">
    <div class="flip-inner" ref="cardElement">
      <!-- Face-Up -->
      <main
        class="face-up z-10 card w-56 h-80 p-3 hover:shadow-xl hover:scale-110 transition-all shadow-lg flex flex-col overflow-hidden border-2">

        <Rank :card="props.card" />

        <!-- Cover -->
        <figure class="cover">
          <PlayButton />
          <img :src="props.card.url_image" alt="cover-image de l'album" :loading="props.imageLoadingType"
            @load="$emit('image-loaded', $event)" class="cover-image w-full h-full object-cover object-center" />
        </figure>

        <!-- Body -->
        <div
          class="card-body p-3 text-center bg-white rounded-b-xl opacity-0 -mt-16 hover:opacity-100 hover:-mt-0 transition-all duration-300">
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
        class="face-down z-10 card w-56 h-80 p-3 bg-opacity-10 bg-white rounded-2xl shadow-lg flex flex-col overflow-hidden select-none">
        <figure class="cover"
          >
          <PlayButton />
          <img src="/face-down.svg" class="cover-image" :style="{ backgroundColor: cardColor }" />
        </figure>
      </footer>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { Card } from '~~/types/types'

const emit = defineEmits(['click', 'image-loaded'])

const props = withDefaults(defineProps<{
  card: Card;
  isFaceUp?: boolean;
  role?: string;
  tabindex?: string | number;
  imageLoadingType?: 'lazy' | 'eager';
  showPlayButtonFaceUp?: boolean;
}>(), {
  isFaceUp: false,
  role: 'button',
  tabindex: '0',
  imageLoadingType: 'eager',
  showPlayButtonFaceUp: false
})

import { getYearColor } from '~/utils/colors'

const cardColor = computed(() => getYearColor(props.card.year || 0))

/* loading states of the card */
const isApiLoaded = ref(false)
const isImageLoaded = ref(false)
const isTrackLoaded = ref(false)

</script>

<style lang="scss">
.label {
  @apply rounded-full size-7 p-2 bg-esyellow leading-3 -mt-6;
  font-weight: bold;
  text-align: center;
}

.♠,
.♣,
.♦,
.♥ {
  @apply text-5xl size-14;
}

/* Flip effect */
.card {
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

      .cover-image {
        border-radius: 0.75rem;
      }
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

  .play-button {
    opacity: 0;
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
  }

  .play-button {
    @apply absolute opacity-0 hover:opacity-100;
  }

  &.show-play-button {
    .play-button {
      opacity: 1;
    }
  }

  &.show-play-button-face-up {
    .face-up {
      .play-button {
        opacity: 1;
      }
    }
  }

  .cover-image:active,
  .face-down:active {
    .play-button {
      @apply scale-90;
    }
  }

  &.is-dragging {
    @apply opacity-50 scale-95 rotate-6;
    cursor: grabbing !important;

    .face-up {
      @apply shadow-2xl;
    }

    .play-button,
    .card-body {
      display: none;
    }
  }
}
</style>