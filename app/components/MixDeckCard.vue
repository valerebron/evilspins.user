<template>
  <section class="mix-deck" :class="{ 'open': isOpen, 'show-play-button': true }">
    <CardElement v-if="card" :key="`card-${card.slug}`" :card="card" :is-face-up="isFaceUp" :is-loading="isLoading"
      role="img" tabindex="-1" />

    <Platine v-if="card && isPlatineMounted" :key="`platine-${card.slug}`" ref="platineRef" :card="card"
      :active="active" class="mix-deck__platine" :class="{ 'mix-deck__platine--visible': isOpen }"
      @loaded="onTrackLoaded" />
  </section>
</template>

<script setup lang="ts">
import { timeout } from '~/utils/timeout'
import type { Card } from '~~/types/types'
import CardElement from '~/components/CardElement.vue'
import Platine from '~/components/Platine.vue'

const props = defineProps<{
  card: Card | null
  label: 'A' | 'B'
  active: boolean
}>()

const emit = defineEmits<{
  ready: []
}>()

const platineRef = ref<InstanceType<typeof Platine> | null>(null)

const isFaceUp = ref(false)
const isOpen = ref(false)
const isLoading = ref(true)
const isPlatineMounted = ref(false)
const ready = ref(false)

const prepareVisualState = () => {
  isFaceUp.value = false
  isOpen.value = false
  isLoading.value = true
  isPlatineMounted.value = !!props.card
  ready.value = false
}

const onTrackLoaded = async () => {
  isFaceUp.value = true
  await timeout(220)
  isOpen.value = true
  isLoading.value = false
  ready.value = true
  emit('ready')
}

const waitUntilReady = (timeoutMs = 12000): Promise<boolean> => {
  if (ready.value) return Promise.resolve(true)

  return new Promise((resolve) => {
    const startedAt = Date.now()
    const timer = window.setInterval(() => {
      if (ready.value) {
        window.clearInterval(timer)
        resolve(true)
        return
      }

      if (Date.now() - startedAt > timeoutMs) {
        window.clearInterval(timer)
        resolve(false)
      }
    }, 100)
  })
}

const play = async (position = 0) => {
  if (!platineRef.value) return false
  return await platineRef.value.play(position)
}

const resume = async () => {
  const current = platineRef.value?.getCurrentTime?.() || 0
  if (!platineRef.value) return false
  return await platineRef.value.play(current)
}

const pause = () => {
  platineRef.value?.pause()
}

const unload = () => {
  platineRef.value?.unload?.()
  isOpen.value = false
  isFaceUp.value = false
  isLoading.value = true
  ready.value = false
}

const setVolume = (volume: number) => {
  platineRef.value?.setVolume?.(volume)
}

const getRemainingTime = () => {
  return platineRef.value?.getRemainingTime?.() ?? Infinity
}

watch(() => props.card, async () => {
  prepareVisualState()
  await nextTick()
})

defineExpose({
  waitUntilReady,
  play,
  resume,
  pause,
  unload,
  setVolume,
  getRemainingTime,
})
</script>

<style scoped lang="scss">
$card-transition-speed: 1.1s;

.mix-deck {
  width: min(100cqw, 100cqh);
  height: min(100cqw, 100cqh);
  aspect-ratio: 1 / 1;
  position: relative;
  transition: all $card-transition-speed cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: stretch;
  justify-content: center;

  :deep(.card-element),
  :deep(.platine) {
    width: 100%;
    height: 100%;
    transition: all $card-transition-speed cubic-bezier(0.4, 0, 0.2, 1);
  }

  :deep(.card-element) {
    position: absolute;

    .card-body {
      display: none;
    }
  }

  &.open {
    :deep(.card-element) {
      pointer-events: none;

      .face-up,
      .face-down {
        border-radius: 100%;

        .cover {
          border-radius: 100%;
        }

        .rank,
        .play-button {
          opacity: 0;
        }
      }
    }
  }
}

.mix-deck__platine {
  opacity: 0;
  pointer-events: none;

  &--visible {
    opacity: 1;
    pointer-events: auto;
  }
}
</style>
