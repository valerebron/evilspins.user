<template>
  <nav class="btm-nav">
    <NuxtLink to="/" class="tooltip" :class="{ 'active': activeDock === '/' }" data-tip="Tirage">
      <object class="icon" data="/dice.svg" type="image/svg+xml" aria-label="tirage" />
    </NuxtLink>

    <NuxtLink to="/compilation" class="tooltip" :class="{ 'active': activeDock === '/compilation' }"
      data-tip="Compilations">
      <object class="icon" data="/cassette.svg" type="image/svg+xml" aria-label="compilations" />
    </NuxtLink>

    <NuxtLink to="/collection" class="tooltip" :class="{ 'active': activeDock === '/collection' }"
      data-tip="Collection">
      <object class="icon" data="/cards.svg" type="image/svg+xml" aria-label="collection" />
    </NuxtLink>
  </nav>
</template>

<script setup lang="ts">
const route = useRoute()

const activeDock = computed(() => route.path)
</script>

<style scoped>
.icon {
  pointer-events: none;
  height: 40px;
}

.tooltip {
  display: flex;
}
</style>