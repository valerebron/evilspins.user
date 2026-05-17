<template>
  <section class="card-list">
    <slot />
  </section>
</template>

<script setup lang="ts">
const { openCardId, setAllowMultipleOpen } = useCardOpenState()

// Default behavior: only one card can be open at a time
setAllowMultipleOpen(false)

// Provide the open card ID to child components
provide('openCardId', openCardId)
</script>

<style lang="scss">
.card-list {
  display: flex;
  flex-wrap: wrap;
  flex-direction: column;

  @screen md {
    flex-direction: row;
  }

  place-items: center;
  justify-content: center;
  gap: 20px;

  min-height: 100svh;
}

.card {
  width: 250px;
  transition: width opacity 0.7s;

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
