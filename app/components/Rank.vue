<template>
  <div :class="{
    'suit-dark': !isRedCard,
    'suit-red': isRedCard,
    'revert': isDarkBackground
  }" class="rank flex items-center justify-center size-[20%] absolute top-[8%] left-[12%] text-[100%]">
    <div class="suit absolute">
      <component :is="svgComponent" :class="{ 'suit-red': isRedCard, 'suit-black': !isRedCard }" />
    </div>
    <div class="number text-white font-bold absolute -mt-1 size-[20%] text-[2cqw]">
      {{ number }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Card } from '~~/types/types';
import HeartSVG from '~/components/svg/HeartSVG.vue'
import DiamondSVG from '~/components/svg/DiamondSVG.vue'
import ClubSVG from '~/components/svg/ClubSVG.vue'
import SpadeSVG from '~/components/svg/SpadeSVG.vue'
import { decode } from 'blurhash'

const props = defineProps<{ card?: Card }>()

const isRedCard = computed(() => (props.card?.suit === '♥' || props.card?.suit === '♦'))

const svgComponent = computed(() => {
  if (!props.card?.suit) return null
  switch (props.card.suit) {
    case '♥': return HeartSVG
    case '♦': return DiamondSVG
    case '♣': return ClubSVG
    case '♠': return SpadeSVG
    default: return null
  }
})

const number = computed(() => {
  return props.card?.rank
})


const isDarkBackground = computed(() => {
  const blurhash = props.card?.blurhash

  if (!blurhash) return false

  const pixels = decode(blurhash, 1, 1)

  const r = pixels[0]
  const g = pixels[1]
  const b = pixels[2]

  // Luminance perceptuelle
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b

  return luminance < 100
})
</script>

<style scoped>
.rank {
  transition: opacity 0.5s ease-in-out;
  container-type: inline-size;
  z-index: 10;

  .suit {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  :deep(svg) {
    width: 100%;
    height: 100%;
    display: block;
  }
}

.number {
  width: 100%;
  font-size: 34cqw;
  line-height: 40cqw;
}

.suit-dark {
  color: black;
}

.suit-red {
  @apply text-red-600;
}
</style>