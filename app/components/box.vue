<template>
  <section class="box-stage" @click="requestToggleSelection">
    <div ref="sceneRef" class="scene" :class="sceneClasses" :style="sceneStyle" @pointerdown="onSpinPointerDown"
      @pointermove="onSpinPointerMove" @pointerup="onSpinPointerUp" @pointercancel="onSpinPointerUp"
      @lostpointercapture="onSpinPointerUp">
      <div class="scene__canvas">
        <div class="box" :class="boxClasses" :style="boxStyle" @transitionstart="onBoxTransitionStart"
          @transitionend="onBoxTransitionEnd" @transitioncancel="onBoxTransitionEnd">
          <div class="box__face box__face--front"></div>
          <div class="box__face box__face--back"></div>
          <div class="box__face box__face--right">right</div>
          <div class="box__face box__face--left">left</div>
          <div class="box__face box__face--top">{{ box?.name }}</div>
          <div class="box__face box__face--bottom"></div>

          <div v-if="stackedCards.length" class="box__cards-volume">
            <div v-for="(item, index) in stackedCards" :key="item.esid || `${item.slug}-${index}`" class="stacked-card"
              :style="getCardStyle(index)">
              <div class="stacked-card-face stacked-card-face--front">
                <div v-if="index === 0 && coverFrontUrl" class="stacked-card-cover stacked-card-cover--front">
                  <img class="stacked-card-cover__image" :src="coverFrontUrl" alt="box front cover" draggable="false" />
                </div>
                <card v-else-if="index === 0" :card="item" :back-color="activeFaceColor" :is-face-up="true"
                  :navigate-on-click="true" :navigate-target="getBoxPlaybackTarget(item.slug)"
                  :show-play-button="false" />
                <BoxBlurhashCard v-else :blurhash="item.blurhash" :card-year="item.year" :is-face-up="true" />
                <div v-if="index === 0 && selectedMode === 'selected'" class="stacked-card-play-overlay">
                  <PlayButton />
                </div>
              </div>
              <div class="stacked-card-face stacked-card-face--back">
                <div v-if="index === lastCardIndex && coverBackUrl" class="stacked-card-cover stacked-card-cover--back">
                  <img class="stacked-card-cover__image" :src="coverBackUrl" alt="box back cover" draggable="false" />
                </div>
                <card v-else-if="index === 0" :card="item" :back-color="activeFaceColor" :is-face-up="false"
                  :navigate-on-click="true" :navigate-target="getBoxPlaybackTarget(item.slug)"
                  :show-play-button="false" />
                <BoxBlurhashCard v-else :blurhash="item.blurhash" :card-year="item.year" :is-face-up="false" />
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

const props = defineProps<{
  box?: BoxDetails | null
  isSelected?: boolean
}>()

const emit = defineEmits<{
  (event: 'toggle-select', face: CompilationSide): void
}>()

const { resolveMediaUrl } = useMediaUrl()

type BoxSide = 'front' | 'right' | 'back' | 'left' | 'top' | 'bottom'
type BoxMode = 'stored' | 'selected'
type CompilationSide = 'A' | 'B'

const isAnimating = ref(false)
const BASE_ORIENTATION = 270
const SIDE_SWITCH_ENERGY_THRESHOLD = 0.16
const SIDE_SWITCH_MIN_DRAG_DISTANCE = 140
const faceDimensions: Record<BoxSide, { widthFactor: number, heightFactor: number }> = {
  front: { widthFactor: 1.5, heightFactor: 1 },
  back: { widthFactor: 1.5, heightFactor: 1 },
  right: { widthFactor: 0.5, heightFactor: 1 },
  left: { widthFactor: 0.5, heightFactor: 1 },
  top: { widthFactor: 1.5, heightFactor: 0.5 },
  bottom: { widthFactor: 1.5, heightFactor: 0.5 },
}

const selectedMode = computed<BoxMode>(() => (props.isSelected ? 'selected' : 'stored'))
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
const spinVelocity = ref(0)
let inertiaFrame = 0
const sceneClasses = computed(() => ({
  'scene--animating': isAnimating.value || isSpinInertiaActive.value,
  'scene--spin-enabled': selectedMode.value === 'selected',
}))
const boxClasses = computed(() => [
  showClass.value,
  {
    'box--dragging': isSpinDragging.value || isSpinInertiaActive.value,
  },
])
const effectiveOrientation = computed(() => (BASE_ORIENTATION + selectedOrientation.value) % 360)
const sceneHeightFactor = computed(() => {
  const dimensions = faceDimensions[selectedSide.value]
  const isQuarterTurn = effectiveOrientation.value === 90 || effectiveOrientation.value === 270

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
const lastCardIndex = computed(() => Math.max(0, stackedCards.value.length - 1))

const switchCompilationSideFromGesture = (dragDeltaX: number) => {
  if (selectedMode.value !== 'selected') return
  if (dragDistance.value < SIDE_SWITCH_MIN_DRAG_DISTANCE) return
  if (Math.abs(spinVelocity.value) < SIDE_SWITCH_ENERGY_THRESHOLD) return

  // Right swipe: A -> B
  if (dragDeltaX > 0) {
    if (requestedCompilationSide.value !== 'B' && availableCompilationSides.value.has('B')) {
      requestedCompilationSide.value = 'B'
    }
    return
  }

  // Left swipe: B -> A
  if (dragDeltaX < 0) {
    if (requestedCompilationSide.value === 'B' && availableCompilationSides.value.has('A')) {
      requestedCompilationSide.value = 'A'
    }
  }
}

const requestToggleSelection = () => {
  if (suppressSelectionClick.value) {
    suppressSelectionClick.value = false
    return
  }

  emit('toggle-select', activeCompilationSide.value)
}

const getBoxPlaybackTarget = (slug: string) => {
  const boxId = props.box?.id
  if (!boxId) {
    return `/card/${slug}?autoplay=true`
  }

  const params = new URLSearchParams({
    box: `${boxId}${activeCompilationSide.value}`,
    start: slug,
  })

  return `/mix/tarot?${params.toString()}`
}

const stopSpinInertia = () => {
  if (inertiaFrame) {
    cancelAnimationFrame(inertiaFrame)
    inertiaFrame = 0
  }

  isSpinInertiaActive.value = false
  spinVelocity.value = 0
}

const startSpinInertia = () => {
  if (selectedMode.value !== 'selected') return
  if (Math.abs(spinVelocity.value) < 0.01) return

  isSpinInertiaActive.value = true
  let lastFrameTime = performance.now()
  const friction = 0.9

  const step = (now: number) => {
    const elapsed = now - lastFrameTime
    lastFrameTime = now

    spinAngle.value += spinVelocity.value * elapsed
    spinVelocity.value *= Math.pow(friction, elapsed / 16.67)

    if (Math.abs(spinVelocity.value) < 0.0025) {
      stopSpinInertia()
      return
    }

    inertiaFrame = requestAnimationFrame(step)
  }

  inertiaFrame = requestAnimationFrame(step)
}

const onSpinPointerDown = (event: PointerEvent) => {
  if (selectedMode.value !== 'selected') return

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
  spinAngle.value -= deltaX * 0.45
  spinVelocity.value = (-deltaX * 0.45) / elapsed
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
  switchCompilationSideFromGesture(dragDeltaX)
  dragDistance.value = 0
  startSpinInertia()
}

watch(selectedMode, (mode) => {
  if (mode === 'selected') {
    spinAngle.value = -35
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

onBeforeUnmount(() => {
  stopSpinInertia()
})

const onBoxTransitionStart = (event: TransitionEvent) => {
  if (event.propertyName !== 'transform') return
  isAnimating.value = true
}

const onBoxTransitionEnd = (event: TransitionEvent) => {
  if (event.propertyName !== 'transform') return
  isAnimating.value = false
}

const getCardStyle = (index: number) => {
  const total = stackedCards.value.length
  const ratio = total <= 1 ? 0.5 : index / (total - 1)

  return {
    '--card-ratio': ratio,
    '--card-order': `${index + 1}`,
  }
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

const coverFrontUrl = computed(() => {
  const coverPath = resolveCoverBySide(props.box?.cover_front || '', activeCompilationSide.value, 'front')
  return resolveMediaUrl(coverPath)
})
const coverBackUrl = computed(() => {
  const coverPath = resolveCoverBySide(props.box?.cover_back || '', activeCompilationSide.value, 'back')
  return resolveMediaUrl(coverPath)
})
</script>

<style scoped lang="scss">
.box-stage {
  font-family: sans-serif;
  position: relative;
  width: 300px;
  justify-self: center;
}

.scene {
  --box-height: 200px;
  --box-depth: 100px;
  --box-width: calc(var(--box-height) * 1.5);

  width: var(--box-width);
  height: calc(var(--box-height) * var(--scene-height-factor, 1));
  // border: 1px solid #ccc;
  overflow: hidden;
  perspective: 400px;
  position: relative;
  z-index: 1;
  transition: height 1s;
  cursor: pointer;

  &:hover .box__face--top {
    text-decoration: underline;
  }

  &.scene--spin-enabled {
    .box__face--top {
      text-decoration: none;
    }
  }
}

.scene.scene--animating {
  z-index: 2;
  overflow: visible;
}

.scene.scene--spin-enabled {
  touch-action: none;
  cursor: pointer;
}

.scene.scene--spin-enabled:active {
  cursor: grabbing;
}

.scene__canvas {
  width: var(--box-width);
  height: var(--box-width);
  position: relative;
  transform: translateY(calc(var(--box-height) * var(--scene-crop-factor, 0) * -1));
  transition: transform 1s;
}

.box {
  width: var(--box-width);
  height: var(--box-height);
  position: absolute;
  left: 0;
  top: calc((var(--box-width) - var(--box-height)) / 2);
  transform-style: preserve-3d;
  transform: translateZ(-50px) rotateZ(var(--box-base-orientation, 270deg));
  transition: transform 1s;
  user-select: none;
}

.box.box--dragging {
  transition: none;
}

.box.show-front {
  transform: translateZ(-50px) rotateZ(calc(var(--box-base-orientation, 270deg) + var(--box-orientation, 0deg))) rotateX(var(--box-drag-spin, 0deg));
}

.box.show-back {
  transform: translateZ(-50px) rotateZ(calc(var(--box-base-orientation, 270deg) + var(--box-orientation, 0deg))) rotateX(var(--box-drag-spin, 0deg)) rotateY(-180deg);
}

.box.show-right {
  transform: translateZ(-150px) rotateZ(calc(var(--box-base-orientation, 270deg) + var(--box-orientation, 0deg))) rotateX(var(--box-drag-spin, 0deg)) rotateY(-90deg);
}

.box.show-left {
  transform: translateZ(-150px) rotateZ(calc(var(--box-base-orientation, 270deg) + var(--box-orientation, 0deg))) rotateX(var(--box-drag-spin, 0deg)) rotateY(90deg);
}

.box.show-top {
  transform: translateZ(-100px) rotateZ(calc(var(--box-base-orientation, 270deg) + var(--box-orientation, 0deg) + var(--box-drag-spin, 0deg))) rotateX(-90deg);
}

.box.show-bottom {
  transform: translateZ(-100px) rotateZ(calc(var(--box-base-orientation, 270deg) + var(--box-orientation, 0deg) + var(--box-drag-spin, 0deg))) rotateX(90deg);
}

.box__face {
  position: absolute;
  // border: 2px solid #000;
  font-size: 40px;
  font-weight: bold;
  color: #000;
  text-align: center;
  background-size: cover;
  background-position: center;
  overflow: hidden;
}

.box__face--front,
.box__face--back {
  width: 300px;
  height: 200px;
  border-radius: 30px;
  // opacity: 0;
}

.box__face--back {
  line-height: 200px;
}

.box__face--right,
.box__face--left {
  width: 100px;
  height: 200px;
  left: 100px;
  line-height: 200px;
}

.box__face--top,
.box__face--bottom {
  width: 300px;
  height: 100px;
  top: 50px;
  line-height: 100px;
}

.box__face--front {
  // background: hsla(0, 100%, 50%, 0.3);
  display: block;
  padding: 8px;
  overflow: hidden;
  background-size: cover;
  background-position: bottom;
}

.box__face--right {
  background: hsla(60, 100%, 50%, 0.3);
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
  transform: rotateY(0deg) translateZ(50px);
}

.box__face--back {
  transform: rotateY(180deg) translateZ(50px);
}

.box__face--right {
  transform: rotateY(90deg) translateZ(150px);
}

.box__face--left {
  transform: rotateY(-90deg) translateZ(150px);
}

.box__face--top {
  transform: rotateX(90deg) translateZ(100px);
}

.box__face--bottom {
  transform: rotateX(-90deg) translateZ(100px);
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
  position: absolute;
  pointer-events: none;
  transform-style: preserve-3d;
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

@media (max-width: 540px) {
  .box-stage {
    width: 270px;
  }

  .box-controls {
    top: 0;
    width: 100%;
  }

  .scene {
    --box-height: 180px;
    --box-depth: 90px;

    width: var(--box-width);
    height: calc(var(--box-height) * var(--scene-height-factor, 1));
  }

  .box {
    width: var(--box-width);
    height: var(--box-height);
  }

  .box__face {
    font-size: 30px;
  }

  .box__face--front,
  .box__face--back {
    width: var(--box-width);
    height: var(--box-height);
  }

  .box__face--back {
    line-height: var(--box-height);
  }

  .box__face--right,
  .box__face--left {
    width: 90px;
    height: var(--box-height);
    left: 90px;
    line-height: var(--box-height);
  }

  .box__face--top,
  .box__face--bottom {
    width: 270px;
    height: 90px;
    top: 45px;
    line-height: 90px;
  }

  .box__face--front {
    transform: rotateY(0deg) translateZ(45px);
  }

  .box__face--back {
    transform: rotateY(180deg) translateZ(45px);
  }

  .box__face--right {
    transform: rotateY(90deg) translateZ(135px);
  }

  .box__face--left {
    transform: rotateY(-90deg) translateZ(135px);
  }

  .box__face--top {
    transform: rotateX(90deg) translateZ(90px);
  }

  .box__face--bottom {
    transform: rotateX(-90deg) translateZ(90px);
  }

  .box.show-front {
    transform: translateZ(-45px) rotateZ(calc(var(--box-base-orientation, 270deg) + var(--box-orientation, 0deg))) rotateX(var(--box-drag-spin, 0deg));
  }

  .box.show-back {
    transform: translateZ(-45px) rotateZ(calc(var(--box-base-orientation, 270deg) + var(--box-orientation, 0deg))) rotateX(var(--box-drag-spin, 0deg)) rotateY(-180deg);
  }

  .box.show-right {
    transform: translateZ(-135px) rotateZ(calc(var(--box-base-orientation, 270deg) + var(--box-orientation, 0deg))) rotateX(var(--box-drag-spin, 0deg)) rotateY(-90deg);
  }

  .box.show-left {
    transform: translateZ(-135px) rotateZ(calc(var(--box-base-orientation, 270deg) + var(--box-orientation, 0deg))) rotateX(var(--box-drag-spin, 0deg)) rotateY(90deg);
  }

  .box.show-top {
    transform: translateZ(-90px) rotateZ(calc(var(--box-base-orientation, 270deg) + var(--box-orientation, 0deg) + var(--box-drag-spin, 0deg))) rotateX(-90deg);
  }

  .box.show-bottom {
    transform: translateZ(-90px) rotateZ(calc(var(--box-base-orientation, 270deg) + var(--box-orientation, 0deg) + var(--box-drag-spin, 0deg))) rotateX(90deg);
  }

  .stacked-card {
    --card-width: calc(var(--box-height) * 0.9);
  }
}
</style>
