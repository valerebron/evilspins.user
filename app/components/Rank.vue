<template>
  <div class="rank flex items-center justify-center size-[20%] absolute top-[8%] right-[12%] text-[100%]">
    <div class="suit absolute" :class="color">
      <img :src="image" />
    </div>
    <div class="number text-white font-bold absolute -mt-1 size-[20%] text-[2cqw]">
      {{ number }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Card } from '~~/types/types';

const props = defineProps<{ card?: Card }>()

const isRedCard = computed(() => (props.card?.suit === '♥' || props.card?.suit === '♦'))

const color = computed(() => {
  if (!props.card) return 'text-slate-800'
  return isRedCard.value ? 'text-red-600' : 'text-slate-800'
})

const image = computed(() => {
  if (props.card?.suit) {
    return `/${props.card.suit}.svg`
  } else {
    return `/${props.card.rank}.svg`
  }
})

const number = computed(() => {
  return props.card?.rank
})
</script>

<style scoped>
.rank {
  transition: opacity 0.5s ease-in-out;
  container-type: inline-size;
}

.number {
  font-size: 34cqw;
  line-height: 34cqw;
  width: 100%;
}
</style>