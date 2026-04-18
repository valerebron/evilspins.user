<template>
  <section class="centered">
    <slot />
  </section>
</template>

<style lang="scss" scoped>
.centered {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  min-height: 100vh;

  .card {
    margin: 1rem;
  }
}
</style>
