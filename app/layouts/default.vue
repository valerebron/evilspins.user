<template>
  <section class="card-list">
    <slot />
  </section>
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
.card-list {
  display: flex;
  flex-wrap: nowrap;
  flex-direction: column;
  overflow-x: auto;

  @screen sm {
    flex-wrap: wrap;
    flex-direction: row;
    overflow-x: visible;
  }

  place-items: center;
  justify-content: center;
  gap: 20px;

  min-height: 100svh;
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

  &.close {
    opacity: 0;
    width: 0;

    overflow: hidden;
    margin: 0;
    padding: 0;
  }
}
</style>
