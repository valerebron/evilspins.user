<template>
  <div class="platine" :class="{ 'loading': isLoadingTrack, 'mounted': isMounted, 'playing': isPlaying }">
    <div v-if="showDebugOverlay" class="debug">
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
      <div class="debug__track">
        <div class="debug__bar">
          <div class="debug__bar-fill debug__bar-fill--disc" :style="{ width: `${debugDiscProgress}%` }" />
          <div class="debug__bar-fill debug__bar-fill--audio" :style="{ width: `${debugAudioProgress}%` }" />
        </div>
        <div class="debug__labels">
          <span>disc {{ formatDebugTime(debugDiscSeconds) }}</span>
          <span>audio {{ formatDebugTime(debugAudioSeconds) }}</span>
          <span>speed {{ currentSpeed.toFixed(2) }}</span>
        </div>
      </div>
    </div>
    <div class="disc" ref="discRef" id="disc">
      <div class="bobine" :style="{
        height: visibleProgressPercentage + '%',
        width: visibleProgressPercentage + '%'
      }"></div>
      <button class="power-button" :class="{ isPowerActive }" @click="Power" @touchstart.passive="isPowerActive = true"
        @touchend="isPowerActive = false" @touchcancel="isPowerActive = false" :disabled="isLoadingTrack">
        <img class="macaron" src="/favicon.svg" v-if="!isEndOfTrack">
        <img class="macaron" src="/rewind.svg" v-if="isEndOfTrack" />
      </button>
      <div class="turn-point" v-if="!isLoadingTrack">
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Card } from '~~/types/types'
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import Disc from '~/utils/platine/disc'
import Sampler from '~/utils/platine/sampler'

const props = withDefaults(defineProps<{
  card?: Card;
  /** Indique si cette platine est la carte actuellement ouverte/visible */
  active?: boolean;
  delegateReplayOnEnd?: boolean;
}>(), {
  card: undefined,
  active: true,
  delegateReplayOnEnd: false,
})

const emit = defineEmits(['loaded', 'finishPlaying', 'play-state-changed', 'replay-requested'])

// State
const isLoadingTrack = ref(false)
const isFirstPlay = ref(true)
const isEndOfTrack = ref(false)
const isPowerActive = ref(false)

const progressPercentage = ref(0)
const frozenProgressPercentage = ref<number | null>(null)
const currentTurns = ref(0)
const totalTurns = ref(0)// Refs pour les instances
const debugDiscSeconds = ref(0)
const debugAudioSeconds = ref(0)

// Refs pour les instances
const disc = ref<Disc | null>(null)
const sampler = ref<Sampler | null>(null)
const discRef = ref<HTMLElement>()
const isMounted = ref(false)

const isPlaying = computed(() => Math.abs(Math.round(sampler.value?.currentSpeed || 0)) !== 0)
const isReversed = computed(() => disc.value?.isReversed || false)
const currentSpeed = computed(() => sampler.value?.currentSpeed || 0)
const showDebugOverlay = false
const debugDiscProgress = computed(() => {
  const duration = getDuration()
  if (!duration) return 0
  return (debugDiscSeconds.value / duration) * 100
})
const debugAudioProgress = computed(() => {
  const duration = getDuration()
  if (!duration) return 0
  return (debugAudioSeconds.value / duration) * 100
})
const visibleProgressPercentage = computed(() => frozenProgressPercentage.value ?? progressPercentage.value)
const { requestWakeLock, releaseWakeLock } = useScreenWakeLock()
const { resolveMediaUrl } = useMediaUrl()

let bobineFreezeTimer: ReturnType<typeof window.setTimeout> | null = null

// Verrou actif pendant un effet de scratch (avance/recul au clavier).
// Pendant l'effet, on laisse le son suivre la courbe de vitesse du scratch
// (1 -> 3 -> 1) sans que la boucle du disque ne force le taux à 1 à chaque frame.
let isScratchEffectActive = false
// Permet de gérer les scratches qui se chevauchent (auto-repeat d'une flèche maintenue) :
// seul le dernier né a le droit de lever le verrou.
let scratchGeneration = 0

const canAutoplayNow = async () => {
  if (!sampler.value) return false
  return await sampler.value.ensureAudioContextRunning()
}

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

    disc.value.callbacks.onDragStart = async () => {
      // Activer le son à chaque fois qu'on glisse, pas seulement au premier play
      if (sampler.value && disc.value) {
        const canPlay = await sampler.value.ensureAudioContextRunning()
        if (!canPlay) return

        // On joue toujours le son quand on glisse, même après une pause
        // Sans accélération pour le scratch
        sampler.value.play(disc.value.secondsPlayed || 0, false)
      }
    }

    disc.value.callbacks.onDragEnded = (secondsPlayed) => {
      if (!sampler.value || !disc.value) return

      // Le buffer source ne se recale pas tout seul après un scratch prolongé.
      // On le recrée sur la position disque courante pour supprimer le retard accumulé.
      sampler.value.play(Math.max(0, secondsPlayed), false)
      updateTurns()
    }

    disc.value.callbacks.onLoop = ({ playbackSpeed, isReversed, secondsPlayed }) => {
      // Ne mettre à jour que si nécessaire et s'assurer que la position est valide.
      // Pendant un scratch au clavier, on ne resynchronise PAS le sampler sur la vitesse
      // du disque : sinon le taux de lecture serait réinitialisé à 1 à chaque frame et
      // la courbe d'accélération/décélération du scratch serait hachée.
      if (!isScratchEffectActive && Math.abs((sampler.value?.currentSpeed || 0) - playbackSpeed) > 0.01) {
        const safeSecondsPlayed = Math.max(0, secondsPlayed)
        sampler.value?.updateSpeed(playbackSpeed, isReversed, safeSecondsPlayed)
      }
      updateTurns()
    }
  }
}

const updateTurns = () => {
  if (!disc.value) return

  debugDiscSeconds.value = disc.value.secondsPlayed
  debugAudioSeconds.value = sampler.value?.getDebugPlayheadSeconds?.() || 0

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
    await sampler.value.loadTrack(resolveMediaUrl(card.url_audio))
    if (disc.value) {
      // console.log('[DISC] Set Duration', sampler.value.duration)
      disc.value.setDuration(sampler.value.duration)
      disc.value.setAngle(0)
      isEndOfTrack.value = false
      currentTurns.value = 0
      totalTurns.value = sampler.value.duration * 0.75
      progressPercentage.value = 17
      updateTurns()
    }
  } finally {
    isLoadingTrack.value = false
    emit('loaded')
  }
}

const play = async (position = 0, withAcceleration = true) => {
  isFirstPlay.value = false
  if (!disc.value || !sampler.value || !props.card) return false

  const canPlay = await sampler.value.ensureAudioContextRunning()
  if (!canPlay) {
    return false
  }

  // Quand on force un replay depuis le début (position 0), on réinitialise aussi le visuel du disque
  if (position === 0) {
    disc.value.setAngle(0)
    isEndOfTrack.value = false
    currentTurns.value = 0
    progressPercentage.value = 17 // valeur minimale définie dans updateTurns
  }

  sampler.value.play(position, withAcceleration)

  if (withAcceleration) {
    disc.value.powerOnWithAcceleration()
  } else {
    disc.value.powerOn()
  }

  emit('play-state-changed', true)
  void requestWakeLock()
  return true
}

const setVolume = (volume: number) => {
  sampler.value?.setVolume(volume)
}

const getCurrentTime = () => {
  return disc.value?.secondsPlayed || 0
}

const getDuration = () => {
  return sampler.value?.duration || 0
}

const getRemainingTime = () => {
  const duration = getDuration()
  if (!duration) return Infinity
  return Math.max(0, duration - getCurrentTime())
}

const formatDebugTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '00:00.00'
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds - (minutes * 60)
  return `${String(minutes).padStart(2, '0')}:${remainingSeconds.toFixed(2).padStart(5, '0')}`
}

const jumpToPosition = async (position: number) => {
  if (!disc.value || !sampler.value) return false

  const duration = getDuration()
  if (!Number.isFinite(duration) || duration <= 0) {
    return false
  }

  const target = Math.max(0, Math.min(position, duration))

  // Saut immédiat pour les tests de transition: pas de rampe d'accélération.
  sampler.value.play(target, false)
  disc.value.setAngle(target * 0.75 * Math.PI * 2)
  updateTurns()
  void requestWakeLock()
  return true
}

const jumpToNearEnd = async (secondsBeforeEnd = 5) => {
  const duration = getDuration()
  if (!Number.isFinite(duration) || duration <= 0) {
    return false
  }

  const target = Math.max(0, duration - secondsBeforeEnd)
  return await jumpToPosition(target)
}

const unload = () => {
  cleanup()
  emit('play-state-changed', false)
  void releaseWakeLock()
  isEndOfTrack.value = false
  progressPercentage.value = 0
  currentTurns.value = 0
  totalTurns.value = 0
}

const freezeBobineFor = (durationMs: number) => {
  if (bobineFreezeTimer) {
    window.clearTimeout(bobineFreezeTimer)
  }

  frozenProgressPercentage.value = progressPercentage.value
  bobineFreezeTimer = window.setTimeout(() => {
    frozenProgressPercentage.value = null
    bobineFreezeTimer = null
  }, durationMs)
}

const pause = () => {
  // console.log('[PAUSE]')
  if (!disc.value || !sampler.value) return

  sampler.value.pauseWithDeceleration()
  disc.value.powerOffWithDeceleration()
  emit('play-state-changed', false)
  void releaseWakeLock()
}

const togglePlay = async () => {
  if (isPlaying.value) {
    pause()
    return false
  } else {
    // Reprendre la lecture à la position actuelle
    const currentPosition = disc.value?.secondsPlayed || 0
    return await play(currentPosition)
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
  void releaseWakeLock()
}

const Power = async () => {
  if (isEndOfTrack.value) {
    if (props.delegateReplayOnEnd) {
      emit('replay-requested')
      return
    }

    await Rewind()
    return
  }
  await togglePlay()
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

  // En fin de morceau, le disque est réellement arrêté (setAngle() appelle
  // stop(), rafId = null) : on relance la lecture pour que le rembobinage soit
  // audible. On attend la résolution pour évaluer l'état réel ensuite.
  if (disc.value.isStopped()) {
    await play(0, false)
  }

  // Voir NextFourSec : isPlaying lit sampler.currentSpeed, l'état audio réel.
  // disc.isStopped() reste false pendant une pause (pas de stop() appelé).
  const wasPlaying = isPlaying.value
  const currentSpeed = disc.value.playbackSpeed

  if (!wasPlaying) {
    // Platine en pause : on recale uniquement la position du disque, SANS
    // toucher au sampler (sampler.play() démarre la lecture). Au prochain
    // togglePlay(), play(disc.secondsPlayed) repositionnera le sampler sur 0.
    disc.value.setAngle(0)
    updateTurns()
    return
  }

  // Pendant tout l'effet, la boucle du disque ne doit pas écraser la vitesse du
  // scratch (même verrou que NextFourSec/PrevFourSec).
  isScratchEffectActive = true
  const generation = ++scratchGeneration

  // Phase 1 : ralentir progressivement À LA POSITION COURANTE.
  // On ne touche pas à la position ici : c'est la phase 2 qui saute au début.
  const slowDownDuration = 300 // ms
  const startTime = performance.now()
  // Math.abs : en lecture inversée la vitesse est négative, mais setPlaybackRate
  // travaille déjà en valeur absolue. On garde donc une décélération positive.
  const startSpeed = Math.abs(currentSpeed) || 1

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

  // Phase 2 : on recale disque et son sur le début, puis effet de scratch.
  const performRewind = () => {
    sampler.value?.play(0, false)
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
        // Vitesse normale à la fin. Pas de "pause puis relance" (l'ancien
        // setTimeout coupait le son 50 ms) : le sampler est déjà en lecture
        // depuis le début du morceau, on laisse donc la lecture se poursuivre
        // sans coupure, et le disque avance déjà depuis setAngle(0).
        sampler.value?.setPlaybackRate(1)

        if (generation === scratchGeneration) {
          isScratchEffectActive = false
        }
      }
    }

    requestAnimationFrame(scratch)
  }

  // Démarrer l'effet (phase 1)
  requestAnimationFrame(slowDown)
}


const NextFourSec = () => {
  if (!disc.value || !sampler.value) return

  const currentPosition = disc.value.secondsPlayed || 0
  const newPosition = Math.min(currentPosition + 4, (disc.value as any)._duration)
  // On se fie à l'état audio réel (isPlaying lit sampler.currentSpeed).
  // disc.isStopped() ne détecte PAS la pause : powerOffWithDeceleration() ne
  // lance jamais disc.stop(), donc la boucle rAF reste active et isStopped()
  // reste false une fois en pause.
  const wasPlaying = isPlaying.value

  // Pendant l'effet, la boucle du disque ne doit pas écraser la vitesse du scratch.
  isScratchEffectActive = true
  const generation = ++scratchGeneration

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
        // On recalcule la position audio SANS rampe d'accélération (1,5 s partant de
        // 0.001), sinon le son s'arrêterait puis remonterait lentement au lieu de
        // décélérer proprement jusqu'à la vitesse d'écoute normale.
        // Si la platine était à l'arrêt, on ne relance pas le son : l'état pause est conservé.
        if (wasPlaying) {
          sampler.value?.play(newPosition, false)
        }
        disc.value?.setAngle(targetAngle)
        // Seul le dernier scratch en date a le droit de lever le verrou.
        if (generation === scratchGeneration) {
          isScratchEffectActive = false
        }
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
  // Voir NextFourSec : on se fie à l'état audio réel, pas à disc.isStopped().
  const wasPlaying = isPlaying.value

  // Pendant l'effet, la boucle du disque ne doit pas écraser la vitesse du scratch.
  isScratchEffectActive = true
  const generation = ++scratchGeneration

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
        // Recalage du playhead SANS rampe d'accélération (voir NextFourSec).
        // Le son ralentit jusqu'à ~0 puis repart vers 1 : on garde l'état de lecture
        // initial, on ne relance pas le son si la platine était à l'arrêt.
        if (wasPlaying) {
          sampler.value?.play(newPosition, false)
        }
        disc.value?.setAngle(targetAngle)
        // Seul le dernier scratch en date a le droit de lever le verrou.
        if (generation === scratchGeneration) {
          isScratchEffectActive = false
        }
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
    if (props.card) {
      await loadAudio(props.card)
    }
  }

  // On attache le listener une seule fois au montage.
  // La vraie protection est le guard "if (!props.active)" en haut de handleKeyDown.
  window.addEventListener('keydown', handleKeyDown)
})

// Nettoyage (seulement si le composant est vraiment démonté plus tard)
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  isMounted.value = false
  if (bobineFreezeTimer) {
    window.clearTimeout(bobineFreezeTimer)
  }
  cleanup()
})

// Surveillance des changements de piste
watch(() => props.card, (newCard) => {
  // console.log('[WATCH] Card', newCard)
  if (newCard) {
    loadAudio(newCard)
  }
})

defineExpose({
  canAutoplayNow,
  pause,
  play,
  jumpToNearEnd,
  freezeBobineFor,
  togglePlay,
  Reverse,
  Rewind,
  setVolume,
  getCurrentTime,
  getDuration,
  getRemainingTime,
  unload,
})
</script>

<style lang="scss">
.platine {
  overflow: hidden;
  position: relative;
  display: flex;
  width: 100%;
  height: 100%;

  .debug {
    position: absolute;
    z-index: 120;
    inset: 10px 10px auto 10px;
    display: grid;
    gap: 8px;
    padding: 10px 12px;
    border-radius: 12px;
    background: rgba(8, 8, 12, 0.78);
    color: #f3f4f6;
    backdrop-filter: blur(12px);
    font-size: 12px;
    line-height: 1.2;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.28);
    pointer-events: none;
  }

  .debug button {
    pointer-events: auto;
    width: fit-content;
  }

  .debug__track {
    display: grid;
    gap: 6px;
  }

  .debug__bar {
    position: relative;
    height: 10px;
    border-radius: 999px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.12);
  }

  .debug__bar-fill {
    position: absolute;
    inset: 0 auto 0 0;
    border-radius: inherit;
  }

  .debug__bar-fill--disc {
    background: rgba(96, 165, 250, 0.55);
  }

  .debug__bar-fill--audio {
    background: rgba(251, 191, 36, 0.55);
  }

  .debug__labels {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: space-between;
    opacity: 0.95;
    font-variant-numeric: tabular-nums;
  }

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
    @apply absolute top-1/2 right-2 size-1/12 rounded-full bg-esyellow;
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

    &:focus-visible {
      outline: none;
      box-shadow: none;
    }

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
    transition: transform 0.1s;
    @apply relative bg-black bg-opacity-70 rounded-full;
  }

  .disc:has(.power-button:active) .bobine,
  .disc:has(.power-button.isPowerActive) .bobine {
    transform: translate(-50%, -50%) scale(0.8);
  }
}
</style>
