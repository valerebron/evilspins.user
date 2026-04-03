<template>
  <section class="deck">
    <slot />
  </section>
</template>

<style lang="scss" scoped>
.deck {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  min-height: 100vh;

  .playing-card {
    margin: 1rem;
  }
}
</style>
