<template>
  <section class="page" :class="{ 'page--fullscreen': isFullscreenPage }">
    <slot />
  </section>
  <!-- <Dock /> -->
</template>

<script setup lang="ts">
const { openCardId } = useCardOpenState()
const route = useRoute()

const isFullscreenPage = computed(() => {
  return route.path === '/' || route.path === ('/compilations') || route.path === ('/mix')
})

useGlobalCardShortcuts()

useOutsideClick(() => {
  if (!openCardId.value) return

  window.dispatchEvent(
    new CustomEvent('card-close-request')
  )
}, {
  exclude: ['.card']
})
</script>

<style lang="scss">
.page {
  display: flex;
  flex-wrap: wrap;
  flex-direction: row;
  overflow-x: visible;
  margin-bottom: 0px;

  place-items: center;
  justify-content: center;
  align-content: center;

  min-height: 100svh;
}

.page.page--fullscreen {
  margin-bottom: 0;
}

.card {
  transition: width height opacity 0.7s;
  width: 14vmax;

  @media (max-width: 768px) {
    width: 30vh;
  }

  &.open {
    width: 100%;
    overflow: hidden;
  }
}
</style>
