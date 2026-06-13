<template>
  <section class="card text-center"
    :class="{ 'open': isOpen, 'close': shouldClose, 'card-enter': isMounted, 'show-play-button': showPlayButton }">
    <CardElement :card="props.card!" :is-face-up="isFaceUp" @click="clickOnCard" :role="isOpen ? 'img' : 'button'"
      :is-loading="isLoading" />
    <Platine v-if="isPlatineMounted" ref="platineRef" :card="card" :active="isOpen"
      :class="{ 'fading-out': isPlatineFading }" @loaded="onTrackLoaded" @finishPlaying="closePlatine"
      v-show="isOpen || isPlatineFading" />
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

const isPlatineMounted = ref(false)
const isOpen = ref(false)
const isPlatineFading = ref(false) // for fade-out matching the audio deceleration on close

// animation on mount so all Card instances animate when inserted
const isMounted = ref(true)

onMounted(() => {
  // Doit rester synchronisé avec $card-mount-speed dans le SCSS (+ un petit buffer)
  setTimeout(() => {
    isMounted.value = false
  }, 550)
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

// Durées pour l'orchestration des animations entre cartes.
// - CARD_TRANSITION_DURATION : durée complète de la transition visuelle (shrink cadre + platine fade) + marge décélération audio.
// - CARD_OTHERS_CLOSE_DELAY  : délai utilisé lors de l'ouverture pour s'assurer que les autres cartes ont entièrement disparu.
const CARD_TRANSITION_DURATION = 1050
const CARD_OTHERS_CLOSE_DELAY = CARD_TRANSITION_DURATION

const cardId = computed(() => props.card.slug)

const shouldClose = computed(() => {
  // If this card is open, don't close it
  if (isOpen.value) return false
  // If no card is open, don't close this one
  if (!openCardId.value) return false
  // If another card is open, close this one
  return openCardId.value !== cardId.value
})

// Quand une autre carte devient active (via le state global), on met en pause
// celle-ci pour éviter que l'audio continue en arrière-plan.
watch(shouldClose, (should) => {
  if (should && isOpen.value) {
    platineRef.value?.pause?.()
    isOpen.value = false
  }
})

const clickOnCard = () => {
  if (props.navigateOnClick) {
    navigateTo(`/card/${props.card.slug}?autoplay=true`)
    return
  }

  // On signale globalement qu'on choisit cette carte.
  // Ça va immédiatement faire shouldClose=true sur les autres → elles commencent leur animation de disparition.
  openCard(cardId.value)

  if (!isPlatineMounted.value) {
    // Nouvelle carte : on la monte. L'ouverture visuelle sera retardée dans onTrackLoaded
    // pour laisser les autres cartes disparaître d'abord.
    isPlatineMounted.value = true
    isLoading.value = true
  } else {
    // Carte déjà montée : on attend un petit délai (CARD_OTHERS_CLOSE_DELAY)
    // avant de lancer notre propre animation d'ouverture.
    setTimeout(() => {
      isOpen.value = true
      platineRef.value?.play?.(0)
      emit('open')
    }, CARD_OTHERS_CLOSE_DELAY)
  }
}

const onTrackLoaded = async () => {
  isFaceUp.value = true

  // On laisse un peu de temps pour l'animation face-up,
  // puis on attend explicitement que les autres cartes aient commencé leur disparition
  // avant de lancer l'ouverture visuelle de cette carte.
  await timeout(350)
  await timeout(CARD_OTHERS_CLOSE_DELAY)

  isOpen.value = true
  emit('open')

  const artist = props.card.artist ?? (props.card as any).name ?? 'Unknown Artist'
  document.title = `${artist} - ${props.card.title}`
  window.history.pushState({}, '', `/card/${props.card.slug}`)
  isLoading.value = false

  // On lance le play (accélération) pendant que l'animation d'ouverture de la carte tourne.
  await timeout(250)
  platineRef.value?.play()
}

const closePlatine = () => {
  // On lance la décélération audio immédiatement.
  platineRef.value?.pause?.()

  // On démarre la fermeture visuelle de la carte ouverte (retrait du .open + fade-out de la platine).
  // IMPORTANT : on ne fait PAS closeCard() tout de suite.
  // Cela permet de garder openCardId défini pendant toute la durée de la transition de fermeture,
  // afin que les autres cartes conservent leur état .close (et donc restent masquées)
  // jusqu'à ce que la carte actuelle ait complètement terminé sa fermeture.
  isPlatineFading.value = true
  isOpen.value = false

  // On effectue le nettoyage (clear du state global, history, emit) seulement une fois
  // la durée complète de la transition de fermeture écoulée.
  // C'est à ce moment-là seulement que les autres cartes vont ré-apparaître.
  setTimeout(() => {
    isPlatineFading.value = false
    closeCard(cardId.value)
    window.history.back()
    emit('close')
  }, CARD_TRANSITION_DURATION)
}

// === Gestion Space (play/pause) au clavier ===
// On gère le Space UNIQUEMENT sur la carte actuellement ouverte.
// Ça évite que plusieurs Platine (toujours montées) réagissent en même temps.
let spaceHandler: ((e: KeyboardEvent) => void) | null = null

const setupSpaceListener = () => {
  cleanupSpaceListener()
  spaceHandler = (e: KeyboardEvent) => {
    if (e.code === 'Space' || e.key === ' ' || e.keyCode === 32) {
      e.preventDefault()
      platineRef.value?.togglePlay?.()
    }
  }
  window.addEventListener('keydown', spaceHandler)
}

const cleanupSpaceListener = () => {
  if (spaceHandler) {
    window.removeEventListener('keydown', spaceHandler)
    spaceHandler = null
  }
}

watch(isOpen, (open) => {
  if (open) {
    // Quand cette carte devient active, on prend le contrôle du Space
    setupSpaceListener()
  } else {
    cleanupSpaceListener()
  }
}, { immediate: true })

// Nettoyage quand le composant Card lui-même est détruit
// (très rare maintenant mais c'est une bonne pratique)
onUnmounted(() => {
  cleanupSpaceListener()
})

// Auto-play logic when autoplay prop is true
watch(() => props.autoplay, (autoplay) => {
  if (autoplay && !isPlatineMounted.value) {
    isPlatineMounted.value = true
    isLoading.value = true
  }
}, { immediate: true })
</script>

<style scoped lang="scss">
/* === VITESSES D'ANIMATION RÉGLABLES === */
// 1. Vitesse d'ouverture / fermeture des cartes
//    (changement de cadre, scale du disque, transition vers la platine)
$card-transition-speed: 1.2s;

// 2. Vitesse d'apparition et de disparition des cartes
//    (animation d'entrée quand les cartes arrivent dans le DOM)
//    → Doit être plus rapide que la transition ci-dessus
$card-mount-speed: 0.2s;

.card {
  &.card-enter {
    animation: scale-in $card-mount-speed cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
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
  transition: all $card-transition-speed cubic-bezier(0.4, 0, 0.2, 1);

  &.open {
    aspect-ratio: 10/10;
    transition: all $card-transition-speed cubic-bezier(0.4, 0, 0.2, 1);
  }

  .card-element,
  .platine {
    height: 100%;
    width: 100%;
    transition: all $card-transition-speed cubic-bezier(0.4, 0, 0.2, 1);
  }

  :deep(.card-element) {
    position: absolute;

    .card-body {
      display: none;
    }

    .face-up,
    .cover {
      transition: all $card-transition-speed cubic-bezier(0.4, 0, 0.2, 1);

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

// Fade out de la platine (quand on ferme la carte)
.platine.fading-out {
  opacity: 0;
  transition: opacity $card-transition-speed ease-out;
  pointer-events: none;
}
</style>