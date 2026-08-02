<template>
  <section class="page">
    <slot />
  </section>
  <Dock />
</template>

<script setup lang="ts">
const { openCardId } = useCardOpenState()

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
  margin-bottom: 64px;

  place-items: center;
  justify-content: center;

  min-height: calc(100svh - 64px);
}

.card {
  transition: width height opacity 0.7s;
  width: 20vh;

  @screen sm {
    width: 33vh;
  }

  &.open {
    width: 100%;
    overflow: hidden;
  }
}
</style>
