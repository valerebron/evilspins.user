<template>
  <component :is="playerComponent" ref="playerRef" :card="card" @loaded="emitLoaded" v-show="show" />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Card } from '~~/types/types'
import { isTarotCard } from '~/utils/playerStrategy'
import Platine from '~/components/Platine.vue'
import TarotPlayer from '~/components/TarotPlayer.vue'

const props = withDefaults(defineProps<{
  card?: Card
  show?: boolean
}>(), {
  show: true,
})

const emit = defineEmits(['loaded'])
const playerRef = ref<InstanceType<typeof Platine> | InstanceType<typeof TarotPlayer> | null>(null)

const playerComponent = computed(() => {
  return isTarotCard(props.card) ? TarotPlayer : Platine
})

const emitLoaded = () => {
  emit('loaded')
}

const play = async () => {
  await playerRef.value?.play?.()
}

const pause = () => {
  playerRef.value?.pause?.()
}

const togglePlay = async () => {
  await playerRef.value?.togglePlay?.()
}

defineExpose({ play, pause, togglePlay })
</script>
