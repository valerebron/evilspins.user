<template>
  <article :role="props.role" :class="[
    'card-element cursor-pointer',
    isFaceUp ? 'face-up' : 'face-down',
    props.isDisabled ? 'is-disabled' : ''
  ]" :tabindex="props.tabindex" :aria-disabled="props.isDisabled" @click="onCardClick" @keydown.enter="onCardEnter">
    <div class="flip-inner" ref="cardElement">
      <!-- Face-Up -->
      <main
        class="face-up z-10 p-[6%] hover:shadow-xl hover:scale-110 transition-all shadow-lg flex flex-col overflow-hidden border-2">

        <Rank :card="props.card" />

        <!-- Cover -->
        <figure class="cover relative">
          <div class="action-buttons z-20" :class="{
            'action-buttons--play': usePlayButton,
            'action-buttons--custom': !usePlayButton,
            'action-buttons--loading-play': usePlayButton && isLoading
          }">
            <PlayButton v-if="usePlayButton" :is-loading="isLoading" :is-playing="props.isPlaying" interactive
              aria-label="play" @click.stop="emitButtonClick(visibleButtons[0] ?? 'play')" />
            <template v-else>
              <button v-for="buttonName in visibleButtons" :key="buttonName" type="button"
                class="btn btn-sm btn-neutral action-button capitalize" @click.stop="emitButtonClick(buttonName)">
                {{ buttonName }}
              </button>
            </template>
          </div>
          <img v-if="isInlineImageUrl" :src="props.card.url_image" alt="card cover"
            class="cover-image relative z-0 w-full h-full object-cover object-center" draggable="false" />
          <UnLazyImage v-else :src="props.card.url_image" alt="card cover" loading="lazy"
            :blurhash="props.card.blurhash" class="cover-image relative z-0 w-full h-full object-cover object-center"
            draggable="false" />
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
          <PlayButton :is-loading="isLoading" :is-playing="props.isPlaying" />
          <img :src="faceDownImageSrc" class="cover-image" :style="{ backgroundColor: cardColor }" draggable="false" />
        </figure>
      </footer>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { Card } from '~~/types/types'

const emit = defineEmits(['click', 'button-click'])
const route = useRoute()

const props = withDefaults(defineProps<{
  card: Card;
  backColor?: string | null;
  isFaceUp?: boolean;
  isLoading?: boolean;
  isDisabled?: boolean;
  isPlaying?: boolean;
  buttons?: string[];
  role?: string;
  tabindex?: string | number;
}>(), {
  backColor: null,
  isFaceUp: false,
  isDisabled: false,
  isPlaying: false,
  buttons: () => ['play'],
  role: 'button',
  tabindex: '0'
})

import { getYearColor } from '~/utils/colors'

const cardColor = computed(() => props.backColor || getYearColor(props.card.year || 0))
const isBoxRoute = computed(() => route.path.startsWith('/compilations'))
const faceDownImageSrc = computed(() => isBoxRoute.value ? '/face-down-tarot.svg' : '/face-down.svg')
const isInlineImageUrl = computed(() => {
  const image = props.card.url_image || ''
  return image.startsWith('blob:') || image.startsWith('data:')
})
const visibleButtons = computed(() => props.buttons?.length ? props.buttons : ['play'])
const usePlayButton = computed(() => visibleButtons.value.length === 1 && visibleButtons.value[0] === 'play')

const emitButtonClick = (button: string) => {
  emit('button-click', {
    button,
    card: props.card
  })
}

const onCardClick = (event: MouseEvent) => {
  if (props.isDisabled) {
    event.preventDefault()
    return
  }

  emit('click', event)
}

const onCardEnter = (event: KeyboardEvent) => {
  if (props.isDisabled) {
    event.preventDefault()
    return
  }

  emit('click', event)
}
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
    background-color: white;

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

  &:focus:not(.is-disabled),
  &.current-card:not(.is-disabled) {
    @apply z-50 scale-110;
    outline: none;

    .face-up {
      @apply shadow-2xl;
      transition:
        box-shadow 0.6s,
        transform 6s;
    }
  }

  &:focus:not(.is-disabled),
  &.current-card:not(.is-disabled) {
    .play-button {
      @apply opacity-100;
    }
  }

  .face-up {

    &:hover {

      .play-button,
      .action-buttons {
        opacity: 1;
      }

      .action-buttons {
        pointer-events: auto;
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

    &.loading {
      opacity: 1 !important;
    }

  }

  .action-buttons {
    position: absolute;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 12px;
    opacity: 0;
    transition: opacity 0.15s;
    pointer-events: none;
    inset: 0;
    padding: 20px;

    .action-button {
      @apply bg-black/50 transition-all duration-100 ease-in-out transform active:scale-90 font-bold scale-110 text-white;
      pointer-events: auto;
      border-radius: 10px;
      aspect-ratio: 1;
      width: 100%;
    }

    .show-play-button &.action-buttons--play {
      @apply opacity-100;
    }

    &.action-buttons--loading-play {
      opacity: 1;
      pointer-events: auto;
    }
  }

  @media (hover: none) and (pointer: coarse) {
    .action-buttons--custom {
      .action-button {
        pointer-events: none;
      }
    }

    .face-up:hover {
      .action-buttons--custom {
        opacity: 0;
        pointer-events: none;
      }
    }

    &:active:not(.is-disabled),
    &:focus:not(.is-disabled),
    &.current-card:not(.is-disabled) {
      .action-buttons--custom {
        opacity: 1;
        pointer-events: auto;

        .action-button {
          pointer-events: auto;
        }
      }
    }
  }

  .cover-image:active,
  .face-down:active {
    .play-button {
      @apply scale-90;
    }
  }

  &.is-disabled {
    cursor: default;

    .cover {
      cursor: default;
    }

    .play-button {
      opacity: 0 !important;
      pointer-events: none;
    }
  }
}
</style>