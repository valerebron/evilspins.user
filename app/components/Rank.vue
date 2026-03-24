<template>
  <div class="rank flex items-center justify-center size-7 absolute top-7 right-7">
    <div class="suit text-7xl absolute" :class="[isRedCard ? 'text-red-600' : 'text-slate-800', props.card?.suit]">
      <img :src="`/${props.card?.suit}.svg`" />
    </div>
    <div class="rank text-white font-bold absolute -mt-1">
      {{ props.card?.rank }}
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Card } from '~~/types/types';

const props = defineProps<{ card?: Card }>()

const isRedCard = computed(() => (props.card?.suit === '♥' || props.card?.suit === '♦'))
</script>

<style>
.rank {
  transition: opacity 0.5s ease-in-out;
}
</style>