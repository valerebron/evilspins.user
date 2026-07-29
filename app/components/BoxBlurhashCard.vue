<template>
  <div class="blurhash-card" :class="{ 'blurhash-card--back': !isFaceUp }">
    <div class="blurhash-card__surface">
      <figure class="blurhash-card__cover">
        <canvas v-if="isFaceUp" ref="canvasRef" class="blurhash-card__canvas" aria-hidden="true" />
        <img v-else src="/face-down.svg" class="blurhash-card__back-image" :style="backStyle" draggable="false"
          alt="" />
      </figure>
    </div>
  </div>
</template>

<script setup lang="ts">
import { decode } from 'blurhash'
import { getYearColor } from '~/utils/colors'

const props = withDefaults(defineProps<{
  blurhash?: string | null
  isFaceUp?: boolean
  cardYear?: number
}>(), {
  blurhash: null,
  isFaceUp: true,
  cardYear: 0,
})

const canvasRef = ref<HTMLCanvasElement | null>(null)
const backStyle = computed(() => ({
  backgroundColor: getYearColor(props.cardYear || 0),
}))

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
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
