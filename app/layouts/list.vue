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
  flex-wrap: nowrap;
  flex-direction: row;
  overflow-x: auto;

  @screen md {
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
  width: 250px;
  transition: width height opacity 0.7s;

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
