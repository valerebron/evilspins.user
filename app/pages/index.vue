<template>
  <Random v-for="i in [0, 1, 2]" :key="i" class="card-reveal" :class="{ 'is-visible': cardsVisible }" :style="{
    '--card-delay': `${i * 120}ms`,
    '--card-rotation': i === 0 ? '-10deg' : i === 1 ? '0deg' : '10deg'
  }" />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const cardsVisible = ref(false)

const revealCards = () => {
  requestAnimationFrame(() => {
    cardsVisible.value = true
  })
}

const onSplashFinished = () => {
  revealCards()
}

onMounted(() => {
  const splashAwareWindow = window as Window & { __evilspinsSplashDone?: boolean }

  if (splashAwareWindow.__evilspinsSplashDone) {
    revealCards()
    return
  }

  window.addEventListener('splash-finished', onSplashFinished, { once: true })
})

onUnmounted(() => {
  window.removeEventListener('splash-finished', onSplashFinished)
})
</script>

<style lang="scss" scoped>
.card-reveal {
  opacity: 0;
  transform: translateY(24vh) scale(0.96);
}

.card-reveal:nth-child(1) {
  margin-top: 10vh;
}

.card-reveal:nth-child(3) {
  margin-top: 10vh;
}

@media (max-width: 540px) {

  .card-reveal:nth-child(1),
  .card-reveal:nth-child(3) {
    margin-top: 0;
  }
}

.card-reveal.is-visible {
  // opacity: 1;
  animation: card-slide-up 650ms cubic-bezier(0.18, 0.8, 0.22, 1) forwards;
  animation-delay: var(--card-delay, 0ms);
}

.card-reveal.open {
  --card-rotation: 0deg;
  margin-top: 0vh;
}

@keyframes card-slide-up {
  from {
    transform: translateY(24vh) scale(0.96);
    opacity: 0;
  }

  to {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}

.card {
  &.close {
    opacity: 0;
    width: 0;

    overflow: hidden;
    margin: 0;
    padding: 0;
  }
}
</style>