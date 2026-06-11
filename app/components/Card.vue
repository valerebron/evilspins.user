<template>
  <section class="card text-center"
    :class="{ 'open': isOpen, 'close': shouldClose, 'card-enter': isMounted, 'show-play-button': showPlayButton }">
    <CardElement :card="props.card!" :is-face-up="isFaceUp" @click="clickOnCard" :role="isOpen ? 'img' : 'button'"
      :is-loading="isLoading" />
    <Platine v-if="isPlatineInit" ref="platineRef" :card="card" @loaded="onTrackLoaded" @finishPlaying="closePlatine"
      v-show="isOpen" />
    <Button v-if="isOpen" @click="closePlatine" key-alias="Escape" class="absolute top-0 right-0"></Button>
  </section>
</template>

<script setup lang="ts">
import type { Card } from '~~/types/types'
import { timeout } from '~/utils/timeout'
import CardElement from './CardElement.vue'

const props = defineProps<{
  card: Card,
  isFaceUp?: boolean,
  navigateOnClick?: boolean,
  autoplay?: boolean,
  showPlayButton?: boolean,
}>()

const emit = defineEmits(['open', 'close'])

const isPlatineInit = ref(false)
const isOpen = ref(false)

// animation on mount so all Card instances animate when inserted
const isMounted = ref(true)

onMounted(() => {
  // keep the enter animation class for the first render
  setTimeout(() => {
    isMounted.value = false
  }, 700)
})

const localIsFaceUp = ref(props.isFaceUp ?? false)

watch(
  () => props.isFaceUp,
  (value) => {
    if (value !== undefined) {
      localIsFaceUp.value = value
    }
  },
  { immediate: true }
)

const isFaceUp = computed({
  get: () => localIsFaceUp.value,
  set: (value) => {
    localIsFaceUp.value = value
  }
})

const isLoading = ref(false)
const isTouch = useIsTouchInterface()

const showPlayButton = computed(() => {
  if (isTouch.value) {
    return isTouch.value
  }
  else if (props.showPlayButton !== undefined) {
    return props.showPlayButton
  }
})

const platineRef = useTemplateRef('platineRef')
const { openCard, closeCard, isCardOpen, openCardId } = useCardOpenState()

const cardId = computed(() => props.card.slug)

const shouldClose = computed(() => {
  // If this card is open, don't close it
  if (isOpen.value) return false
  // If no card is open, don't close this one
  if (!openCardId.value) return false
  // If another card is open, close this one
  return openCardId.value !== cardId.value
})

const clickOnCard = () => {
  if (props.navigateOnClick) {
    navigateTo(`/card/${props.card.slug}?autoplay=true`)
    return
  }

  // Close other cards immediately on click
  openCard(cardId.value)


  if (!isPlatineInit.value) {
    isPlatineInit.value = true
    isLoading.value = true
  } else {
    isOpen.value = true
    platineRef.value?.play()
    emit('open')
  }
}

const onTrackLoaded = async () => {
  isFaceUp.value = true
  await timeout(700)
  isOpen.value = true
  emit('open')
  const artist = props.card.artist ?? (props.card as any).name ?? 'Unknown Artist'
  document.title = `${artist} - ${props.card.title}`
  // Modifier l'URL seulement si ce n'est pas une carte aléatoire
  window.history.pushState({}, '', `/card/${props.card.slug}`)
  isLoading.value = false
  await timeout(500)
  platineRef.value?.play()
}

const closePlatine = () => {
  isOpen.value = false
  isPlatineInit.value = false
  closeCard(cardId.value)
  window.history.back();
  emit('close')
}

// Auto-play logic when autoplay prop is true
watch(() => props.autoplay, (autoplay) => {
  if (autoplay && !isPlatineInit.value) {
    isPlatineInit.value = true
    isLoading.value = true
  }
}, { immediate: true })
</script>

<style scoped lang="scss">
$open-speed: 0.7s;

.card {
  &.card-enter {
    animation: scale-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    // animation: card-slide-in 600ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  @keyframes scale-in {
    from {
      transform: scale(0.7);
      opacity: 0;
    }

    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  @keyframes card-slide-in {
    0% {
      transform: translateY(50px) scale(0.95);
      opacity: 0;
    }

    60% {
      transform: translateY(-6px) scale(1.02);
      opacity: 1;
    }

    100% {
      transform: translateY(0) scale(1);
    }
  }

  aspect-ratio: 7/10;
  position: relative;
  max-height: 100vmin;
  max-width: 100vmin;
  transition: all $open-speed;

  &.open {
    aspect-ratio: 10/10;
    transition: all $open-speed;
  }

  .card-element,
  .platine {
    height: 100%;
    width: 100%;
    transition: max-width $open-speed, max-height $open-speed, transform 0.1s;
  }

  :deep(.card-element) {
    position: absolute;

    .card-body {
      display: none;
    }

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
    .card-element {
      pointer-events: none;

      &:focus {
        @apply z-auto scale-100;
      }
    }

    &:deep(.card-element) {

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