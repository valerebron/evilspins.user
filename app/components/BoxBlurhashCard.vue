<template>
  <div class="blurhash-card" :class="{ 'blurhash-card--back': !isFaceUp }">
    <div class="blurhash-card__surface">
      <figure class="blurhash-card__cover">
        <template v-if="isFaceUp">
          <canvas ref="canvasRef" class="blurhash-card__canvas" aria-hidden="true" />
          <div v-if="showRankBadge" class="blurhash-card__rank" :class="rankColorClass">
            <img v-if="rankSuitImage" :src="rankSuitImage" class="blurhash-card__rank-suit" draggable="false" alt="" />
            <span class="blurhash-card__rank-number">{{ cardRank }}</span>
          </div>
        </template>
        <div v-else class="blurhash-card__back-image" :style="backStyle" aria-hidden="true">
          <img v-if="useTarotBack" src="/face-down-tarot.svg" class="blurhash-card__tarot-back" draggable="false"
            alt="" />
          <div v-else class="blurhash-card__back-glyph"></div>
        </div>
      </figure>
    </div>
  </div>
</template>

<script setup lang="ts">
import { decode } from 'blurhash'
import { getYearColor } from '~/utils/colors'
import type { Rank, Suit } from '~~/types/types'

const props = withDefaults(defineProps<{
  blurhash?: string | null
  isFaceUp?: boolean
  cardYear?: number
  backColor?: string | null
  cardRank?: Rank | string | null
  cardSuit?: Suit | string | null
  showRankBadge?: boolean
  useTarotBack?: boolean
}>(), {
  blurhash: null,
  isFaceUp: true,
  cardYear: 0,
  backColor: null,
  cardRank: null,
  cardSuit: null,
  showRankBadge: false,
  useTarotBack: false,
})

const canvasRef = ref<HTMLCanvasElement | null>(null)
const backStyle = computed(() => ({
  backgroundColor: props.backColor || getYearColor(props.cardYear || 0),
}))
const rankSuitImage = computed(() => {
  return props.cardSuit ? `/${props.cardSuit}.svg` : ''
})
const rankColorClass = computed(() => {
  return props.cardSuit === '♥' || props.cardSuit === '♦'
    ? 'blurhash-card__rank--red'
    : 'blurhash-card__rank--dark'
})

const renderBlurhash = () => {
  const canvas = canvasRef.value
  if (!canvas) return

  const context = canvas.getContext('2d')
  if (!context) return

  const width = 32
  const height = 48
  canvas.width = width
  canvas.height = height

  if (!props.blurhash) {
    context.fillStyle = props.isFaceUp ? '#d7ddd6' : '#c6d0c4'
    context.fillRect(0, 0, width, height)
    return
  }

  const pixels = decode(props.blurhash, width, height)
  const imageData = context.createImageData(width, height)
  imageData.data.set(pixels)
  context.putImageData(imageData, 0, 0)
}

onMounted(renderBlurhash)
watch(() => [props.blurhash, props.isFaceUp], renderBlurhash)
</script>

<style scoped lang="scss">
.blurhash-card {
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.5);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
  padding: 6%;
}

.blurhash-card--back {
  background: rgba(255, 255, 255, 0.1);
}

.blurhash-card__surface,
.blurhash-card__cover {
  width: 100%;
  height: 100%;
}

.blurhash-card__cover {
  margin: 0;
  overflow: hidden;
  border-radius: 12px;
  position: relative;
}

.blurhash-card__surface {
  border-radius: 16px;
}

.blurhash-card__canvas {
  display: block;
  width: 100%;
  height: 100%;
  transform: scale(1.06);
  transform-origin: center;
}

.blurhash-card__back-image {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  border-radius: 12px;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
}

.blurhash-card__tarot-back {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.blurhash-card__rank {
  position: absolute;
  bottom: 8%;
  right: 10%;
  width: 22%;
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  transform: rotate(180deg);
  z-index: 1;
}

.blurhash-card__rank--red {
  color: #dc2626;
}

.blurhash-card__rank--dark {
  color: #111827;
}

.blurhash-card__rank-suit {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.blurhash-card__rank-number {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.35rem;
  line-height: 1;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
}

.blurhash-card__back-glyph {
  width: 58%;
  height: 58%;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.32);
  box-shadow:
    inset 0 0 0 10px rgba(255, 255, 255, 0.08),
    0 0 0 10px rgba(0, 0, 0, 0.05);
  position: relative;

  &::before,
  &::after {
    content: '';
    position: absolute;
    inset: 22%;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.22);
  }

  &::after {
    inset: 39%;
    background: rgba(255, 255, 255, 0.18);
    border: 0;
  }
}
</style>
