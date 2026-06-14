<template>
  <div class="platine" :class="{ 'loading': isLoadingTrack, 'mounted': isMounted, 'playing': isPlaying }">
    <div v-if="false" class="debug">
      <button @click="Reverse">
        <b v-if="isReversed">reversed</b>
        <b v-else>normal</b>
      </button>
      <button @click="Rewind">
        Rewind
      </button>
      <button @click="NextFourSec">
        Next Five
      </button>
      <button @click="PrevFourSec">
        Prev Five
      </button>
      <!-- <div>{{ progressPercentage }}</div> -->
      <div>{{ (currentSpeed).toFixed(2) }}</div>
    </div>
    <div class="disc" ref="discRef" id="disc">
      <div class="bobine" :style="{
        height: progressPercentage + '%',
        width: progressPercentage + '%'
      }"></div>
      <button @touchend="isPowerActive = false; Power()" @touchcancel="isPowerActive = false" :class="{ isPowerActive }"
        class="power-button" @click="Power" @touchstart.passive="isPowerActive = true" :disabled="isLoadingTrack">
        <img class="macaron" src="/favicon.svg" v-if="!isEndOfTrack">
        <img class="macaron" @click="Rewind" src="/rewind.svg" v-if="isEndOfTrack" />
      </button>
      <div class="turn-point" v-if="!isLoadingTrack">
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Card } from '~~/types/types'
import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue'
import Disc from '~/utils/platine/disc'
import Sampler from '~/utils/platine/sampler'

const props = withDefaults(defineProps<{
  card?: Card;
  /** Indique si cette platine est la carte actuellement ouverte/visible */
  active?: boolean;
}>(), {
  card: undefined,
  active: true,
})

const emit = defineEmits(['loaded', 'finishPlaying'])

// State
const isLoadingTrack = ref(false)
const isFirstPlay = ref(true)
const isEndOfTrack = ref(false)
const isPowerActive = ref(false)

const progressPercentage = ref(0)
const currentTurns = ref(0)
const totalTurns = ref(0)// Refs pour les instances

// Refs pour les instances
const disc = ref<Disc | null>(null)
const sampler = ref<Sampler | null>(null)
const discRef = ref<HTMLElement>()
const isMounted = ref(false)

const isPlaying = computed(() => Math.abs(Math.round(sampler.value?.currentSpeed || 0)) !== 0)
const isReversed = computed(() => disc.value?.isReversed || false)
const currentSpeed = computed(() => sampler.value?.currentSpeed || 0)

// Actions
const initPlatine = (element: HTMLElement) => {
  // console.log('[INIT] Platine')
  discRef.value = element
  disc.value = new Disc(element)
  sampler.value = new Sampler()

  // Configurer les callbacks du disque
  if (disc.value) {
    disc.value.callbacks.onStop = () => {
      // console.log('[DISC] On Stop')
      sampler.value?.pause()
    }

    disc.value.callbacks.onDragStart = () => {
      // Activer le son à chaque fois qu'on glisse, pas seulement au premier play
      if (sampler.value && disc.value) {
        // On joue toujours le son quand on glisse, même après une pause
        // Sans accélération pour le scratch
        sampler.value.play(disc.value.secondsPlayed || 0, false)
      }
    }

    disc.value.callbacks.onLoop = ({ playbackSpeed, isReversed, secondsPlayed }) => {
      // Ne mettre à jour que si nécessaire et s'assurer que la position est valide
      if (Math.abs((sampler.value?.currentSpeed || 0) - playbackSpeed) > 0.01) {
        const safeSecondsPlayed = Math.max(0, secondsPlayed)
        sampler.value?.updateSpeed(playbackSpeed, isReversed, safeSecondsPlayed)
      }
      updateTurns()
    }
  }
}

const updateTurns = () => {
  if (!disc.value) return

  const newTurns = disc.value.secondsPlayed * 0.75
  const newTotalTurns = (disc.value as any)._duration * 0.75

  // Calcul du pourcentage de progression pour l'affichage visuel (17% à 100%)
  const minPercentage = 17
  const maxPercentage = 100
  const progressRatio = disc.value.secondsPlayed / (disc.value as any)._duration
  const newProgressPercentage = minPercentage + (progressRatio * (maxPercentage - minPercentage))

  // Ne mettre à jour que si les valeurs ont changé de manière significative
  if (
    Math.abs(currentTurns.value - newTurns) > 0.01 ||
    Math.abs(totalTurns.value - newTotalTurns) > 0.01 ||
    Math.abs(progressPercentage.value - newProgressPercentage) > 0.1
  ) {
    currentTurns.value = newTurns
    totalTurns.value = newTotalTurns
    progressPercentage.value = newProgressPercentage
    isEndOfTrack.value = disc.value.secondsPlayed + 0.1 >= (disc.value as any)._duration
    if (isEndOfTrack.value) {
      emit('finishPlaying')
    }
  }
}

const loadAudio = async (card: Card) => {
  // console.log('[LOAD CARD]', card)
  if (!sampler.value || !card) return

  isLoadingTrack.value = true
  // console.log(disc.value)
  try {
    await sampler.value.loadTrack(card.url_audio)
    if (disc.value) {
      // console.log('[DISC] Set Duration', sampler.value.duration)
      disc.value.setDuration(sampler.value.duration)
      updateTurns()
    }
  } finally {
    isLoadingTrack.value = false
    emit('loaded')
  }
}

const play = (position = 0) => {
  isFirstPlay.value = false
  if (!disc.value || !sampler.value || !props.card) return

  // Quand on force un replay depuis le début (position 0), on réinitialise aussi le visuel du disque
  if (position === 0) {
    disc.value.setAngle(0)
    isEndOfTrack.value = false
    currentTurns.value = 0
    progressPercentage.value = 17 // valeur minimale définie dans updateTurns
  }

  sampler.value.play(position, true)
  disc.value.powerOnWithAcceleration()
}

const pause = () => {
  // console.log('[PAUSE]')
  if (!disc.value || !sampler.value) return

  sampler.value.pauseWithDeceleration()
  disc.value.powerOffWithDeceleration()
}

const togglePlay = () => {
  if (isPlaying.value) {
    pause()
  } else {
    // Reprendre la lecture à la position actuelle
    const currentPosition = disc.value?.secondsPlayed || 0
    play(currentPosition)
  }
}

// Nettoyage
const cleanup = () => {
  // console.log('[CLEANUP] Platine')
  if (disc.value) {
    disc.value.stop()
    disc.value.powerOff()
  }
  if (sampler.value) {
    sampler.value.pause()
  }
}

const Power = (e: MouseEvent) => {
  if (isEndOfTrack.value) {
    Rewind()
  }
  togglePlay()
}

const Reverse = () => {
  if (!disc.value || !sampler.value) return

  // Sauvegarder la position actuelle
  const currentPosition = disc.value.secondsPlayed || 0
  const wasPlaying = !disc.value.isStopped()

  // Inverser la direction du disque et du sampler
  disc.value.reverse()
  sampler.value.reverse(wasPlaying ? currentPosition : 0)
}

const Rewind = async () => {
  if (!disc.value || !sampler.value) return

  // Sauvegarder l'état actuel
  disc.value.isStopped() ? play() : null
  const wasPlaying = !disc.value.isStopped()
  const currentSpeed = disc.value.playbackSpeed

  // Fonction pour l'effet de scratch/pull up
  const scratchEffect = async () => {
    // Ralentir progressivement
    const slowDownDuration = 300 // ms
    const startTime = performance.now()
    const startSpeed = wasPlaying ? currentSpeed : 0.1

    const slowDown = (timestamp: number) => {
      const elapsed = timestamp - startTime
      const progress = Math.min(elapsed / slowDownDuration, 1)

      // Courbe d'accélération pour un effet plus naturel
      const easeOut = 1 - Math.pow(1 - progress, 2)

      // Ralentir progressivement jusqu'à presque l'arrêt
      const newSpeed = startSpeed * (1 - easeOut) + 0.05
      sampler.value?.setPlaybackRate(newSpeed)

      if (progress < 1) {
        requestAnimationFrame(slowDown)
      } else {
        // Une fois ralenti, effectuer le rembobinage
        performRewind()
      }
    }

    requestAnimationFrame(slowDown)
    play()
  }

  const performRewind = () => {
    // Mettre en pause la lecture actuelle
    if (wasPlaying) {
      sampler.value?.pause()
    }

    // Remettre à zéro la position
    sampler.value?.play(0)
    disc.value?.setAngle(0)

    // Effet de scratch rapide
    const scratchDuration = 200 // ms
    const scratchStart = performance.now()

    const scratch = (timestamp: number) => {
      const elapsed = timestamp - scratchStart
      const progress = Math.min(elapsed / scratchDuration, 1)

      // Créer un effet de scratch en variant la vitesse
      if (progress < 0.5) {
        // Phase de scratch vers l'arrière
        const scratchProgress = progress * 2
        const scratchSpeed = 1 - (scratchProgress * 1.8) // Ralenti jusqu'à -0.8
        sampler.value?.setPlaybackRate(scratchSpeed)
      } else {
        // Phase de pull up
        const pullProgress = (progress - 0.5) * 2
        const pullSpeed = -0.8 + (pullProgress * 1.8) // Accélère de -0.8 à 1.0
        sampler.value?.setPlaybackRate(pullSpeed)
      }

      if (progress < 1) {
        requestAnimationFrame(scratch)
      } else {
        // Remettre la vitesse normale à la fin
        sampler.value?.setPlaybackRate(1)

        // Si c'était en lecture avant, relancer la lecture
        if (wasPlaying) {
          setTimeout(() => {
            sampler.value?.play(0)
          }, 50)
        }
      }
    }

    requestAnimationFrame(scratch)
  }

  // Démarrer l'effet
  scratchEffect()
}


const NextFourSec = () => {
  if (!disc.value || !sampler.value) return

  const currentPosition = disc.value.secondsPlayed || 0
  const newPosition = Math.min(currentPosition + 4, (disc.value as any)._duration)
  const wasPlaying = !disc.value.isStopped()

  const scratchEffect = () => {
    const scratchDuration = 300
    const scratchStart = performance.now()
    const startAngle = currentPosition * 0.75 * Math.PI * 2 // Convert seconds to radians
    const targetAngle = newPosition * 0.75 * Math.PI * 2

    const scratch = (timestamp: number) => {
      const elapsed = timestamp - scratchStart
      const progress = Math.min(elapsed / scratchDuration, 1)

      // Effet de scratch vers l'avant
      if (progress < 0.5) {
        const scratchProgress = progress * 2
        const scratchSpeed = 1 + (scratchProgress * 2) // Accélère de 1 à 3
        sampler.value?.setPlaybackRate(scratchSpeed)
      } else {
        const pullProgress = (progress - 0.5) * 2
        const pullSpeed = 3 - (pullProgress * 2) // Ralentit de 3 à 1
        sampler.value?.setPlaybackRate(pullSpeed)
      }

      // Mettre à jour l'angle du disque
      const currentAngle = startAngle + ((targetAngle - startAngle) * progress)
      disc.value?.setAngle(currentAngle)

      if (progress < 1) {
        requestAnimationFrame(scratch)
      } else {
        sampler.value?.play(newPosition, wasPlaying)
        disc.value?.setAngle(targetAngle)
      }
    }

    requestAnimationFrame(scratch)
  }

  scratchEffect()
}

const PrevFourSec = () => {
  if (!disc.value || !sampler.value) return

  const currentPosition = disc.value.secondsPlayed || 0
  const newPosition = Math.max(currentPosition - 4, 0)
  const wasPlaying = !disc.value.isStopped()

  const scratchEffect = () => {
    const scratchDuration = 300
    const scratchStart = performance.now()
    const startAngle = currentPosition * 0.75 * Math.PI * 2 // Convert seconds to radians
    const targetAngle = newPosition * 0.75 * Math.PI * 2

    const scratch = (timestamp: number) => {
      const elapsed = timestamp - scratchStart
      const progress = Math.min(elapsed / scratchDuration, 1)

      // Effet de scratch vers l'arrière
      if (progress < 0.5) {
        const scratchProgress = progress * 2
        const scratchSpeed = 1 - (scratchProgress * 2) // Ralentit de 1 à -1
        sampler.value?.setPlaybackRate(scratchSpeed)
      } else {
        const pullProgress = (progress - 0.5) * 2
        const pullSpeed = -1 + (pullProgress * 2) // Accélère de -1 à 1
        sampler.value?.setPlaybackRate(pullSpeed)
      }

      // Mettre à jour l'angle du disque
      const currentAngle = startAngle + ((targetAngle - startAngle) * progress)
      disc.value?.setAngle(currentAngle)

      if (progress < 1) {
        requestAnimationFrame(scratch)
      } else {
        sampler.value?.play(newPosition, wasPlaying)
        disc.value?.setAngle(targetAngle)
      }
    }

    requestAnimationFrame(scratch)
  }

  scratchEffect()
}

const handleKeyDown = (e: KeyboardEvent) => {
  // Plus de gestion du Space ici (voir Card.vue).
  // On ne gère plus que les flèches, et seulement si cette platine est active.
  if (!props.active) return

  if (e.code === 'ArrowRight' || e.key === 'ArrowRight') {
    e.preventDefault()
    NextFourSec()
  } else if (e.code === 'ArrowLeft' || e.key === 'ArrowLeft') {
    e.preventDefault()
    PrevFourSec()
  }
}

// Initialisation du lecteur
onMounted(async () => {
  isMounted.value = true
  if (discRef.value) {
    initPlatine(discRef.value)
    await loadAudio(props.card!)
  }

  // On attache le listener une seule fois au montage.
  // La vraie protection est le guard "if (!props.active)" en haut de handleKeyDown.
  window.addEventListener('keydown', handleKeyDown)
})

// Nettoyage (seulement si le composant est vraiment démonté plus tard)
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  isMounted.value = false
  cleanup()
})

// Surveillance des changements de piste
watch(() => props.card, (newCard) => {
  // console.log('[WATCH] Card', newCard)
  if (newCard) {
    loadAudio(newCard)
  }
})

defineExpose({ pause, play, togglePlay, Reverse, Rewind })
</script>

<style lang="scss">
.platine {
  overflow: hidden;
  position: relative;
  display: flex;
  width: 100%;
  height: 100%;

  .disc {
    pointer-events: auto;
    position: absolute;
    background-color: transparent;
    position: relative;
    aspect-ratio: 1;
    width: 100%;
    overflow: hidden;
    border-radius: 50%;
    cursor: grab;
    background-position: center;
    background-size: cover;
    padding: 6%;

    .loading & {
      box-shadow: none;
    }
  }

  .turn-point {
    @apply absolute top-1/2 right-8 size-1/12 rounded-full bg-esyellow;
  }

  .disc.is-scratching {
    cursor: grabbing;
  }

  .power-button {
    position: absolute;
    z-index: 100;
    cursor: pointer;
    transition: all 0.1s;
    display: flex;
    justify-content: center;
    align-items: center;
    transform-origin: center;
    width: 33%;
    height: 33%;
    border-radius: 100%;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);

    .macaron {
      position: absolute;
      filter: grayscale(1);
      transition: transform 0.1s, filter 0.8s;
      @apply size-2/3;
    }

    &:active,
    &.isPowerActive {
      .macaron {
        transform: scale(0.8);
      }
    }
  }

  &.playing .power-button .macaron {
    filter: grayscale(0);
  }

  .disc-middle {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 20px;
    height: 20px;
    background: rgb(26, 26, 26);
    border-radius: 50%;
  }

  .bobine {
    width: 17%;
    height: 17%;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    @apply relative bg-black bg-opacity-60 backdrop-blur-sm rounded-full;
  }
}
</style>
