<template>
  <section class="box-stage" :class="{ 'box-enter': isMounted }" :style="boxStageStyle">
    <div ref="sceneRef" class="scene" :class="sceneClasses" :style="sceneStyle" @pointerdown="onSpinPointerDown"
      @pointermove="onSpinPointerMove" @pointerup="onSpinPointerUp" @pointercancel="onSpinPointerUp"
      @lostpointercapture="onSpinPointerUp">
      <div class="scene__canvas" @click="requestToggleSelection">
        <div ref="boxRef" class="box" :class="boxClasses" :style="boxStyle" @transitionstart="onBoxTransitionStart"
          @transitionend="onBoxTransitionEnd" @transitioncancel="onBoxTransitionEnd">
          <div class="box__face box__face--front" :style="faceStyle">
            <img v-if="frontCoverUrl" class="box-face-cover box-face-cover--front" :src="frontCoverUrl"
              alt="box front cover" draggable="false" />
          </div>
          <div class="box__face box__face--back" :style="faceStyle">
            <img v-if="backCoverUrl" class="box-face-cover box-face-cover--back" :src="backCoverUrl"
              alt="box back cover" draggable="false" />
          </div>
          <div class="box__face box__face--right" :style="faceStyle"></div>
          <div class="box__face box__face--left"></div>
          <div class="box__face box__face--top" :style="faceStyle">{{ box?.name }}</div>
          <div class="box__face box__face--bottom" :style="faceStyle">{{ box?.name }}</div>

          <div v-if="shouldRenderCardsVolume" class="box__cards-volume"
            :class="{ 'box__cards-volume--revealed': isCardsVolumeRevealed }">
            <div v-for="(item, index) in stackedCards" :key="item.esid || `${item.slug}-${index}`" class="stacked-card"
              :style="getCardStyle(index)">
              <div class="stacked-card-face stacked-card-face--front">
                <BoxBlurhashCard :blurhash="item.blurhash" :card-year="item.year" :is-face-up="true"
                  :show-rank-badge="index === 0" :card-rank="item.rank || null" :card-suit="item.suit || null" />
              </div>
              <div class="stacked-card-face stacked-card-face--back">
                <BoxBlurhashCard :card-year="item.year" :back-color="activeFaceColor" :is-face-up="false"
                  :use-tarot-back="index === stackedCards.length - 1" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { BoxDetails } from '~~/types/types'

type BoxSide = 'front' | 'right' | 'back' | 'left' | 'top' | 'bottom'
type BoxMode = 'stored' | 'selected'
type CompilationSide = 'A' | 'B'

type BoxRotation = {
  x: number
  y: number
  z: number
}

type BoxRotationMap = Partial<Record<BoxMode, Partial<BoxRotation>>>

const props = defineProps<{
  box?: BoxDetails | null
  isSelected?: boolean
  forcedMode?: BoxMode
  modeRotations?: BoxRotationMap
  disableInteraction?: boolean
  enterDelayMs?: number
}>()

const emit = defineEmits<{
  (event: 'toggle-select', face: CompilationSide): void
  (event: 'face-changed', face: CompilationSide): void
}>()

const { resolveMediaUrl } = useMediaUrl()

const isAnimating = ref(false)
const isMounted = ref(false)
const BASE_ORIENTATION = 270
const DEFAULT_SELECTED_SPIN_ANGLE = -35
const FULL_TURN_DEGREES = 360
const HALF_TURN_DEGREES = 180
const SIDE_SWITCH_ENERGY_THRESHOLD = 0.16
const SIDE_SWITCH_MIN_DRAG_DISTANCE = 140
const Z_INDEX_OPEN_RATIO = 0.1
const Z_INDEX_CLOSE_RATIO = 0.57
const faceDimensions: Record<BoxSide, { widthFactor: number, heightFactor: number }> = {
  front: { widthFactor: 1.5, heightFactor: 1 },
  back: { widthFactor: 1.5, heightFactor: 1 },
  right: { widthFactor: 0.5, heightFactor: 1 },
  left: { widthFactor: 0.5, heightFactor: 1 },
  top: { widthFactor: 1.5, heightFactor: 0.5 },
  bottom: { widthFactor: 1.5, heightFactor: 0.5 },
}

const selectedMode = computed<BoxMode>(() => (props.forcedMode || (props.isSelected ? 'selected' : 'stored')))
const hasRotationOverrides = computed(() => Boolean(props.modeRotations))
const isSpinInteractionEnabled = computed(() => {
  return selectedMode.value === 'selected' && !props.disableInteraction
})

const activeModeRotation = computed<BoxRotation>(() => {
  const rawRotation = props.modeRotations?.[selectedMode.value]
  return {
    x: Number(rawRotation?.x ?? 0),
    y: Number(rawRotation?.y ?? 0),
    z: Number(rawRotation?.z ?? 0),
  }
})
const requestedCompilationSide = ref<CompilationSide>('A')
const availableCompilationSides = computed<Set<CompilationSide>>(() => {
  const sides = new Set<CompilationSide>()
  for (const card of props.box?.cards ?? []) {
    const normalizedSide = typeof card.box_side === 'string' ? card.box_side.toUpperCase() : ''
    if (normalizedSide === 'A' || normalizedSide === 'B') {
      sides.add(normalizedSide)
    }
  }

  return sides
})
const activeCompilationSide = computed<CompilationSide>(() => {
  if (requestedCompilationSide.value === 'B' && availableCompilationSides.value.has('B')) {
    return 'B'
  }
  if (availableCompilationSides.value.has('A')) {
    return 'A'
  }
  if (availableCompilationSides.value.has('B')) {
    return 'B'
  }

  return 'A'
})
const activeFaceColor = computed(() => props.box?.color?.[activeCompilationSide.value] || null)
const selectedSide = computed<BoxSide>(() => {
  if (selectedMode.value === 'stored') return 'top'
  return 'front'
})
const selectedOrientation = computed(() => (selectedMode.value === 'stored' ? 90 : 0))
const showClass = computed(() => `show-${selectedSide.value}`)
const spinAngle = ref(0)
const isSpinDragging = ref(false)
const isSpinInertiaActive = ref(false)
const activePointerId = ref<number | null>(null)
const lastPointerX = ref(0)
const lastPointerTime = ref(0)
const dragStartX = ref(0)
const dragDistance = ref(0)
const suppressSelectionClick = ref(false)
const sceneRef = ref<HTMLElement | null>(null)
const boxRef = ref<HTMLElement | null>(null)
const spinVelocity = ref(0)
const elevateSelectedZIndex = ref(false)
const shouldRenderCardsVolume = ref(false)
const isCardsVolumeRevealed = ref(false)
let selectedZIndexTimer: ReturnType<typeof setTimeout> | null = null
let cardsUnmountTimer: ReturnType<typeof setTimeout> | null = null
let cardsRevealFrameA = 0
let cardsRevealFrameB = 0
let inertiaFrame = 0
let mountAnimationTimeout: ReturnType<typeof setTimeout> | null = null
const sceneClasses = computed(() => ({
  'scene--animating': isAnimating.value || isSpinInertiaActive.value,
  'scene--selected-priority': elevateSelectedZIndex.value,
  'scene--selected': selectedMode.value === 'selected',
  'scene--spin-enabled': isSpinInteractionEnabled.value,
}))
const boxStageStyle = computed(() => ({
  '--box-enter-delay': `${Math.max(props.enterDelayMs ?? 0, 0)}ms`,
}))
const boxClasses = computed(() => [
  showClass.value,
  {
    'box--dragging': isSpinDragging.value || isSpinInertiaActive.value,
    'box--rotation-overrides': hasRotationOverrides.value,
  },
])
const effectiveOrientation = computed(() => (BASE_ORIENTATION + selectedOrientation.value) % 360)
const effectiveSceneOrientation = computed(() => {
  const zRotation = activeModeRotation.value.z
  return ((effectiveOrientation.value + zRotation) % 360 + 360) % 360
})
const sceneHeightFactor = computed(() => {
  const dimensions = faceDimensions[selectedSide.value]
  const isQuarterTurn = effectiveSceneOrientation.value === 90 || effectiveSceneOrientation.value === 270

  return isQuarterTurn ? dimensions.widthFactor : dimensions.heightFactor
})
const sceneCropFactor = computed(() => (1.5 - sceneHeightFactor.value) / 2)
const sceneStyle = computed(() => ({
  '--scene-crop-factor': `${sceneCropFactor.value}`,
  '--scene-height-factor': `${sceneHeightFactor.value}`,
}))
const boxStyle = computed(() => ({
  '--box-base-orientation': `${BASE_ORIENTATION}deg`,
  '--box-drag-spin': `${spinAngle.value}deg`,
  '--box-orientation': `${selectedOrientation.value}deg`,
  '--box-rotation-x': `${activeModeRotation.value.x}deg`,
  '--box-rotation-y': `${activeModeRotation.value.y}deg`,
  '--box-rotation-z': `${activeModeRotation.value.z}deg`,
}))
const stackedCards = computed(() => {
  const cards = props.box?.cards ?? []
  const cardsWithSide = cards.filter(card => typeof card.box_side === 'string' && card.box_side.length > 0)

  // Default to face A and switch to B only when explicitly requested.
  if (cardsWithSide.length > 0) {
    const preferredSideCards = cardsWithSide.filter(card => card.box_side?.toUpperCase() === activeCompilationSide.value)
    if (preferredSideCards.length > 0) return preferredSideCards

    const faceBCards = cardsWithSide.filter(card => card.box_side?.toUpperCase() === 'B')
    if (faceBCards.length > 0) {
      return faceBCards
    }

    const faceACards = cardsWithSide.filter(card => card.box_side?.toUpperCase() === 'A')
    if (faceACards.length > 0) {
      return faceACards
    }
  }

  return cards
})

const hasStackedCards = computed(() => stackedCards.value.length > 0)
const getNearestEquivalentAngle = (currentAngle: number, baseAngle: number) => {
  const turns = Math.round((currentAngle - baseAngle) / FULL_TURN_DEGREES)
  return baseAngle + turns * FULL_TURN_DEGREES
}

const normalizeAngleDelta = (delta: number) => {
  return ((delta + HALF_TURN_DEGREES) % FULL_TURN_DEGREES + FULL_TURN_DEGREES) % FULL_TURN_DEGREES - HALF_TURN_DEGREES
}

const switchCompilationSideFromGesture = (dragDeltaX: number) => {
  if (selectedMode.value !== 'selected') return
  if (dragDistance.value < SIDE_SWITCH_MIN_DRAG_DISTANCE) return false
  if (Math.abs(spinVelocity.value) < SIDE_SWITCH_ENERGY_THRESHOLD) return false

  let switched = false

  // Right swipe: A -> B
  if (dragDeltaX > 0) {
    if (requestedCompilationSide.value !== 'B' && availableCompilationSides.value.has('B')) {
      requestedCompilationSide.value = 'B'
      emit('face-changed', requestedCompilationSide.value)
      switched = true
    }
    return switched
  }

  // Left swipe: B -> A
  if (dragDeltaX < 0) {
    if (requestedCompilationSide.value === 'B' && availableCompilationSides.value.has('A')) {
      requestedCompilationSide.value = 'A'
      emit('face-changed', requestedCompilationSide.value)
      switched = true
    }
  }

  return switched
}

const requestToggleSelection = () => {
  if (suppressSelectionClick.value) {
    suppressSelectionClick.value = false
    return
  }

  emit('toggle-select', activeCompilationSide.value)
}

const resolveCoverBySide = (coverPath: string, side: CompilationSide, face: 'front' | 'back'): string => {
  if (side !== 'B') return coverPath

  const withExplicitSuffix = coverPath.replace(
    new RegExp(`${face}-a(\\.[^./]+)$`, 'i'),
    `${face}-b$1`,
  )
  if (withExplicitSuffix !== coverPath) return withExplicitSuffix

  return coverPath.replace(
    new RegExp(`${face}(\\.[^./]+)$`, 'i'),
    `${face}-b$1`,
  )
}

const frontCoverUrl = computed(() => {
  const coverPath = resolveCoverBySide(props.box?.cover_front || '', activeCompilationSide.value, 'front')
  return resolveMediaUrl(coverPath)
})

const backCoverUrl = computed(() => {
  const coverPath = resolveCoverBySide(props.box?.cover_back || '', activeCompilationSide.value, 'back')
  return resolveMediaUrl(coverPath)
})

const faceStyle = computed(() => ({
  backgroundColor: activeFaceColor.value || '#d9d2c4',
}))

const stopSpinInertia = () => {
  if (inertiaFrame) {
    cancelAnimationFrame(inertiaFrame)
    inertiaFrame = 0
  }

  isSpinInertiaActive.value = false
  spinVelocity.value = 0
}

const startSpinInertia = (settleToDefaultAxis = false) => {
  if (!isSpinInteractionEnabled.value) return

  const settleTarget = settleToDefaultAxis
    ? getNearestEquivalentAngle(spinAngle.value, DEFAULT_SELECTED_SPIN_ANGLE)
    : null

  if (Math.abs(spinVelocity.value) < 0.01 && !settleTarget) return

  isSpinInertiaActive.value = true
  let lastFrameTime = performance.now()
  const friction = 0.9

  const step = (now: number) => {
    const elapsed = now - lastFrameTime
    lastFrameTime = now

    spinAngle.value += spinVelocity.value * elapsed
    spinVelocity.value *= Math.pow(friction, elapsed / 16.67)

    if (settleTarget !== null && Math.abs(spinVelocity.value) < 0.03) {
      // Recalage plus lent, en suivant toujours le chemin angulaire le plus court.
      const settleBlend = 1 - Math.pow(0.93, elapsed / 16.67)
      const shortestDelta = normalizeAngleDelta(settleTarget - spinAngle.value)
      spinAngle.value += shortestDelta * settleBlend

      if (Math.abs(shortestDelta) < 0.2 && Math.abs(spinVelocity.value) < 0.003) {
        spinAngle.value += shortestDelta
        stopSpinInertia()
        return
      }
    }

    if (Math.abs(spinVelocity.value) < 0.0025) {
      if (settleTarget !== null) {
        const shortestDelta = normalizeAngleDelta(settleTarget - spinAngle.value)
        spinAngle.value += shortestDelta
      }
      stopSpinInertia()
      return
    }

    inertiaFrame = requestAnimationFrame(step)
  }

  inertiaFrame = requestAnimationFrame(step)
}

const onSpinPointerDown = (event: PointerEvent) => {
  if (!isSpinInteractionEnabled.value) return

  stopSpinInertia()
  isSpinDragging.value = true
  activePointerId.value = event.pointerId
  dragStartX.value = event.clientX
  dragDistance.value = 0
  lastPointerX.value = event.clientX
  lastPointerTime.value = performance.now()
  suppressSelectionClick.value = false

  const scene = sceneRef.value
  if (scene) {
    scene.setPointerCapture(event.pointerId)
  }
}

const onSpinPointerMove = (event: PointerEvent) => {
  if (!isSpinDragging.value) return
  if (activePointerId.value !== event.pointerId) return

  const deltaX = event.clientX - lastPointerX.value
  dragDistance.value = Math.max(dragDistance.value, Math.abs(event.clientX - dragStartX.value))
  if (Math.abs(event.clientX - dragStartX.value) > 6) {
    suppressSelectionClick.value = true
  }

  const now = performance.now()
  const elapsed = Math.max(now - lastPointerTime.value, 1)
  spinAngle.value += deltaX * 0.45
  spinVelocity.value = (deltaX * 0.45) / elapsed
  lastPointerX.value = event.clientX
  lastPointerTime.value = now
}

const onSpinPointerUp = (event: PointerEvent) => {
  if (!isSpinDragging.value) return
  if (activePointerId.value !== event.pointerId) return

  const scene = sceneRef.value
  if (scene && scene.hasPointerCapture(event.pointerId)) {
    scene.releasePointerCapture(event.pointerId)
  }

  activePointerId.value = null
  isSpinDragging.value = false
  const dragDeltaX = event.clientX - dragStartX.value
  const switchedSide = switchCompilationSideFromGesture(dragDeltaX)
  dragDistance.value = 0
  startSpinInertia(switchedSide)
}

watch(selectedMode, (mode) => {
  if (mode === 'selected') {
    spinAngle.value = hasRotationOverrides.value ? 0 : DEFAULT_SELECTED_SPIN_ANGLE
    return
  }

  stopSpinInertia()
  isSpinDragging.value = false
  activePointerId.value = null
  suppressSelectionClick.value = false
  spinAngle.value = 0
  dragDistance.value = 0
})

watch(() => props.box?.id, () => {
  requestedCompilationSide.value = 'A'
})

watch(hasRotationOverrides, (enabled) => {
  if (!enabled) {
    return
  }

  stopSpinInertia()
  isSpinDragging.value = false
  activePointerId.value = null
  suppressSelectionClick.value = false
  spinAngle.value = 0
  dragDistance.value = 0
})

onBeforeUnmount(() => {
  stopSpinInertia()

  if (mountAnimationTimeout) {
    clearTimeout(mountAnimationTimeout)
    mountAnimationTimeout = null
  }

  if (selectedZIndexTimer) {
    clearTimeout(selectedZIndexTimer)
    selectedZIndexTimer = null
  }

  if (cardsUnmountTimer) {
    clearTimeout(cardsUnmountTimer)
    cardsUnmountTimer = null
  }

  if (cardsRevealFrameA) {
    cancelAnimationFrame(cardsRevealFrameA)
    cardsRevealFrameA = 0
  }

  if (cardsRevealFrameB) {
    cancelAnimationFrame(cardsRevealFrameB)
    cardsRevealFrameB = 0
  }
})

const onBoxTransitionStart = (event: TransitionEvent) => {
  if (event.propertyName !== 'transform') return
  isAnimating.value = true
}

const onBoxTransitionEnd = (event: TransitionEvent) => {
  if (event.propertyName !== 'transform') return
  isAnimating.value = false
}

const getBoxTransitionDurationMs = () => {
  const node = boxRef.value
  if (!node) {
    return 0
  }

  const transitionDurationRaw = getComputedStyle(node).transitionDuration
  const firstDuration = transitionDurationRaw.split(',')[0]?.trim() || '0s'
  const durationMs = firstDuration.endsWith('ms')
    ? Number.parseFloat(firstDuration)
    : Number.parseFloat(firstDuration) * 1000

  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return 0
  }

  return durationMs
}

const getZIndexDelayMs = (ratio: number) => {
  const durationMs = getBoxTransitionDurationMs()
  return Math.max(durationMs * ratio, 0)
}

watch(selectedMode, (mode, previousMode) => {
  if (selectedZIndexTimer) {
    clearTimeout(selectedZIndexTimer)
    selectedZIndexTimer = null
  }

  const openDelayMs = getZIndexDelayMs(Z_INDEX_OPEN_RATIO)
  const closeDelayMs = getZIndexDelayMs(Z_INDEX_CLOSE_RATIO)

  if (mode === 'selected') {
    // Opening: become topmost slightly before mid animation.
    elevateSelectedZIndex.value = false
    selectedZIndexTimer = setTimeout(() => {
      elevateSelectedZIndex.value = true
      selectedZIndexTimer = null
    }, openDelayMs)
    return
  }

  if (previousMode === 'selected') {
    // Closing: keep topmost for first half, then drop.
    elevateSelectedZIndex.value = true
    selectedZIndexTimer = setTimeout(() => {
      elevateSelectedZIndex.value = false
      selectedZIndexTimer = null
    }, closeDelayMs)
    return
  }

  elevateSelectedZIndex.value = false
})

watch([selectedMode, hasStackedCards], async ([mode, hasCards]) => {
  if (cardsUnmountTimer) {
    clearTimeout(cardsUnmountTimer)
    cardsUnmountTimer = null
  }

  if (cardsRevealFrameA) {
    cancelAnimationFrame(cardsRevealFrameA)
    cardsRevealFrameA = 0
  }

  if (cardsRevealFrameB) {
    cancelAnimationFrame(cardsRevealFrameB)
    cardsRevealFrameB = 0
  }

  if (mode !== 'selected' || !hasCards) {
    isCardsVolumeRevealed.value = false

    if (!shouldRenderCardsVolume.value) {
      return
    }

    const unmountDelayMs = getBoxTransitionDurationMs()
    cardsUnmountTimer = setTimeout(() => {
      cardsUnmountTimer = null

      if (selectedMode.value !== 'selected') {
        shouldRenderCardsVolume.value = false
      }
    }, unmountDelayMs)
    return
  }

  // Mount cards first, then reveal on the next paint to keep the exit animation smooth.
  shouldRenderCardsVolume.value = true
  isCardsVolumeRevealed.value = false
  await nextTick()

  cardsRevealFrameA = requestAnimationFrame(() => {
    cardsRevealFrameA = 0
    cardsRevealFrameB = requestAnimationFrame(() => {
      cardsRevealFrameB = 0
      isCardsVolumeRevealed.value = true
    })
  })
}, { immediate: true })

const getCardStyle = (index: number) => {
  const total = stackedCards.value.length
  const ratio = total <= 1 ? 0.5 : index / (total - 1)

  return {
    '--card-ratio': ratio,
    '--card-order': `${index + 1}`,
  }
}

const startMountAnimation = () => {
  if (mountAnimationTimeout) {
    clearTimeout(mountAnimationTimeout)
  }

  isMounted.value = true

  const enterDelay = Math.max(props.enterDelayMs ?? 0, 0)
  const totalDurationMs = enterDelay + 1000 + 80

  mountAnimationTimeout = setTimeout(() => {
    isMounted.value = false
    mountAnimationTimeout = null
  }, totalDurationMs)
}

onMounted(() => {
  startMountAnimation()
})

</script>

<style scoped lang="scss">
.box-stage {
  display: flex;
  font-family: sans-serif;
  position: relative;
  width: 70px;
  justify-self: center;

  &.box-enter {
    animation: box-scale-in 1s cubic-bezier(0, 0, 0.34, 1) both;
    animation-delay: var(--box-enter-delay, 0ms);
  }
}

@keyframes box-scale-in {
  from {
    transform: translateX(50px);
    opacity: 0;
  }

  to {
    transform: translateX(0px);
    opacity: 1;
  }
}

.scene {
  --box-height: 200px;
  --box-depth: 50px;
  --box-width: calc(var(--box-height) * 1.5);
  --box-thickness: 60px;
  --box-half-height: calc(var(--box-height) / 2);
  --box-half-thickness: calc(var(--box-thickness) / 2);
  --box-half-width: calc(var(--box-width) / 2);
  --box-hover-advance: 40px;
  --box-hover-advance-max: 110px;
  --box-hover-shift-x: 0px;
  --box-hover-shift-x-max: -30px;
  --box-hover-transition-duration: 0.4s;
  --box-state-transition-duration: 1s;

  width: var(--box-width);
  height: calc(var(--box-height) * var(--scene-height-factor, 1));
  // border: 1px solid #ccc;
  overflow: visible;
  perspective: 1800px;
  perspective-origin: 50% 46%;
  position: relative;
  z-index: 1;
  transition: height 1s;
  cursor: pointer;

  &:not(.scene--selected) {

    &:hover,
    &:active,
    &:focus {
      --box-hover-advance: var(--box-hover-advance-max);
      --box-hover-shift-x: var(--box-hover-shift-x-max);
    }
  }

  &.scene--spin-enabled {
    .box__face--top {
      text-decoration: none;
    }
  }
}

.scene.scene--animating {
  overflow: visible;
}

.scene.scene--selected-priority {
  z-index: 12;
}

.scene.scene--spin-enabled {
  touch-action: none;
  cursor: pointer;
  overflow: visible;
}

.scene.scene--spin-enabled:active {
  cursor: grabbing;
}

.scene__canvas {
  width: 100%;
  height: 100%;
  position: relative;
  transform-style: preserve-3d;
  transform: translateY(calc(var(--box-height) * var(--scene-crop-factor, 0) * -1)) translateX(var(--box-hover-shift-x)) translateZ(var(--box-hover-advance));
  transition: transform var(--box-hover-transition-duration) ease;
}

.box {
  width: var(--box-width);
  height: var(--box-height);
  position: absolute;
  left: 0;
  top: calc((var(--box-width) - var(--box-height)) / 2);
  transform-style: preserve-3d;
  --box-offset-x: -90px;
  transform: translateX(var(--box-offset-x)) translateZ(calc(var(--box-half-thickness) * -1)) rotateZ(var(--box-base-orientation, 270deg));
  transition: transform var(--box-state-transition-duration) ease;
  will-change: transform;
  user-select: none;
}

.box.box--dragging {
  transition: none;
}

.box.show-front {
  transform: translateX(var(--box-offset-x)) translateZ(calc(var(--box-half-thickness) * -1)) rotateZ(calc(var(--box-base-orientation, 270deg) + var(--box-orientation, 0deg))) rotateY(var(--box-drag-spin, 0deg));

  .box__cards-volume.box__cards-volume--revealed {
    left: -80px;
  }
}

.box.show-back {
  transform: translateX(var(--box-offset-x)) translateZ(calc(var(--box-half-thickness) * -1)) rotateZ(calc(var(--box-base-orientation, 270deg) + var(--box-orientation, 0deg))) rotateY(calc(var(--box-drag-spin, 0deg) - 180deg));
}

.box.show-right {
  transform: translateX(var(--box-offset-x)) translateZ(calc(var(--box-half-width) * -1)) rotateZ(calc(var(--box-base-orientation, 270deg) + var(--box-orientation, 0deg))) rotateY(calc(var(--box-drag-spin, 0deg) - 90deg));
}

.box.show-left {
  transform: translateX(var(--box-offset-x)) translateZ(calc(var(--box-half-width) * -1)) rotateZ(calc(var(--box-base-orientation, 270deg) + var(--box-orientation, 0deg))) rotateY(calc(var(--box-drag-spin, 0deg) + 90deg));
}

.box.show-top {
  transform: translateX(var(--box-offset-x)) translateZ(calc(var(--box-half-height) * -1)) rotateZ(calc(var(--box-base-orientation, 270deg) + var(--box-orientation, 0deg) + var(--box-drag-spin, 0deg))) rotateX(-90deg);
}

.box.show-bottom {
  transform: translateX(var(--box-offset-x)) translateZ(calc(var(--box-half-height) * -1)) rotateZ(calc(var(--box-base-orientation, 270deg) + var(--box-orientation, 0deg) + var(--box-drag-spin, 0deg))) rotateX(90deg);
}

.box.box--rotation-overrides.show-front {
  transform: translateX(var(--box-offset-x)) translateZ(calc(var(--box-half-thickness) * -1)) rotateZ(calc(var(--box-base-orientation, 270deg) + var(--box-orientation, 0deg) + var(--box-rotation-z, 0deg))) rotateY(calc(var(--box-drag-spin, 0deg) + var(--box-rotation-y, 0deg))) rotateX(var(--box-rotation-x, 0deg));
}

.box.box--rotation-overrides.show-top {
  transform: translateX(var(--box-offset-x)) translateZ(calc(var(--box-half-height) * -1)) rotateZ(calc(var(--box-base-orientation, 270deg) + var(--box-orientation, 0deg) + var(--box-drag-spin, 0deg) + var(--box-rotation-z, 0deg))) rotateY(var(--box-rotation-y, 0deg)) rotateX(calc(-90deg + var(--box-rotation-x, 0deg)));
}

.box__face {
  position: absolute;
  border: 2px solid #000;
  font-size: 28px;
  font-weight: bold;
  color: #000;
  text-align: center;
  background-size: cover;
  background-position: center;
  overflow: hidden;
}

.box__face--front,
.box__face--back {
  width: var(--box-width);
  height: var(--box-height);
  // border-radius: 30px;
  // opacity: 0;
}

.box__face--back {
  line-height: var(--box-height);
}

.box__face--right,
.box__face--left {
  width: var(--box-thickness);
  height: var(--box-height);
  left: calc((var(--box-width) - var(--box-thickness)) / 2);
  line-height: var(--box-height);
}

.box__face--top,
.box__face--bottom {
  width: var(--box-width);
  height: var(--box-thickness);
  top: calc((var(--box-height) - var(--box-thickness)) / 2);
  line-height: var(--box-thickness);
}

.box__face--front {
  // background: hsla(0, 100%, 50%, 0.3);
  display: block;
  overflow: hidden;
}

.box-face-cover {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.box-face-cover--front {
  // transform: rotate(90deg) scale(1.35);
  transform-origin: center;
  object-position: bottom;
}

.box-face-cover--back {
  // transform: rotate(90deg) scale(1.35);
  transform-origin: center;
  object-position: center;
}

// .box__face--back {
//   background: hsla(120, 100%, 50%, 0.3);
// }

// .box__face--left {
//   background: hsla(180, 100%, 50%, 0.3);
// }

// .box__face--top {
//   background: hsla(240, 100%, 50%, 0.3);
// }

// .box__face--bottom {
//   background: hsla(300, 100%, 50%, 0.3);
// }

.box__face--front {
  transform: rotateY(0deg) translateZ(var(--box-half-thickness));
}

.box__face--back {
  transform: rotateY(180deg) translateZ(var(--box-half-thickness));
}

.box__face--right {
  transform: rotateY(90deg) translateZ(var(--box-half-width));
}

.box__face--left {
  transform: rotateY(-90deg) translateZ(var(--box-half-width));
}

.box__face--top {
  transform: rotateX(90deg) translateZ(var(--box-half-height));
}

.box__face--bottom {
  transform: rotateX(-90deg) translateZ(var(--box-half-height));
}

.mode-switch {
  width: 100%;
  margin: 0;
  padding: 0.65rem 0.6rem;
  border: 1px solid rgba(25, 17, 10, 0.2);
  border-radius: 0.85rem;
  background: rgba(255, 252, 245, 0.94);
  box-shadow: 0 8px 20px rgba(25, 17, 10, 0.08);
  font-size: 0.78rem;
  line-height: 1.2;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
}

.face-label {
  margin: 0;
  line-height: 1;
}

.box__cards-volume {
  width: 100%;
  height: 100%;
  inset: 0;
  left: 0;
  position: absolute;
  pointer-events: none;
  transform-style: preserve-3d;
  transition: left var(--box-state-transition-duration) ease;
}

.stacked-card {
  position: absolute;
  left: 50%;
  top: 50%;
  --card-width: calc(var(--box-height) * 0.9);

  width: var(--card-width);
  height: calc(var(--card-width) * 10 / 7);
  transform-origin: center;
  transform: translate(-50%, -50%) rotateZ(90deg) translateZ(calc((0.5 - var(--card-ratio)) * (var(--box-depth) - 8px)));
  z-index: var(--card-order);
  pointer-events: auto;
  transform-style: preserve-3d;
}

.stacked-card-face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  display: block;
  border-radius: 10px;
  overflow: hidden;
}

.stacked-card-face--front {
  transform: rotateY(0deg);
}

.stacked-card-face--back {
  transform: rotateY(180deg);
}

.stacked-card-play-overlay {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.stacked-card-play-overlay :deep(.play-button) {
  opacity: 0.9;
  transition: transform 0.16s ease, opacity 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease;
}

.scene.scene--spin-enabled:hover .stacked-card-play-overlay :deep(.play-button) {
  opacity: 1;
  transform: scale(1.08);
  filter: brightness(1.08) saturate(1.1);
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.28);
}

.scene.scene--spin-enabled:active .stacked-card-play-overlay :deep(.play-button) {
  transform: scale(0.94);
  filter: brightness(0.96) saturate(1);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.24);
}

.stacked-card-cover {
  width: 100%;
  height: 100%;
  border-radius: 16px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.5);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
  padding: 6%;
}

.stacked-card-cover--back {
  background: rgba(255, 255, 255, 0.1);
}

.stacked-card-cover__image {
  width: 100%;
  height: 100%;
  border-radius: 12px;
  object-fit: cover;
  object-position: center;
  display: block;
}

.stacked-card-face :deep(.card) {
  width: 100%;
  height: 100%;
  max-height: none;
  max-width: none;
  min-height: 0;
}
</style>
