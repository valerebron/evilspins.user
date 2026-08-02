<template>
  <nav class="dock">
    <NuxtLink to="/" class="tooltip" :class="{ 'dock-active': activeDock === '/' }">
      <div class="tooltip-content">
        Tirage
      </div>
      <object class="icon" data="/dice.svg" type="image/svg+xml" aria-label="tirage" />
    </NuxtLink>

    <NuxtLink to="/compilation" class="tooltip" :class="{ 'dock-active': activeDock === '/compilation' }">
      <div class="tooltip-content">
        Compilations
      </div>
      <object class="icon" data="/cassette.svg" type="image/svg+xml" aria-label="compilations" />
    </NuxtLink>

    <NuxtLink to="/collection" class="tooltip" :class="{ 'dock-active': activeDock === '/collection' }">
      <div class="tooltip-content">
        Collection
      </div>
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

.dock-active {
  &::before {
    content: '';
    background-color: black;
    height: 4px;
    width: 50%;
    position: absolute;
    bottom: 0;
  }
}
</style>