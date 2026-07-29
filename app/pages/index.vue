<template>
  <Random v-for="i in [0, 1, 2]" :key="i" />
</template>

<style lang="scss" scoped>
.card {
  &:not(.open) {
    &:first-child {
      transform: rotate(-10deg);
    }

    &:last-child {
      transform: rotate(10deg);
    }

    &:first-child,
    &:last-child {
      margin-top: 10vh;
    }

    @media (max-width: 540px) {

      &:first-child,
      &:last-child {
        margin-top: 0;
      }

      &:nth-child(odd) {
        transform: rotate(-10deg);
      }

      &:nth-child(even) {
        transform: rotate(10deg);
      }
    }
  }
}
</style>