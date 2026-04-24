<template>
  <section class="card-list">
    <slot />
  </section>
</template>

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
  padding: 20px;
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

    @screen lg {
      width: 0;
    }

    overflow: hidden;
    margin: 0;
    padding: 0;
  }
}
</style>
