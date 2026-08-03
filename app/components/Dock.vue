<template>
  <nav class="btm-nav">
    <NuxtLink to="/" class="tooltip" :class="{ 'active': activeDock === '/' }" data-tip="Tirage">
      <DiceSVG />
    </NuxtLink>

    <NuxtLink to="/compilation" class="tooltip" :class="{ 'active': activeDock === '/compilation' }"
      data-tip="Compilations">
      <CassetteSVG />
    </NuxtLink>

    <NuxtLink to="/collection" class="tooltip" :class="{ 'active': activeDock === '/collection' }"
      data-tip="Collection">
      <CardsSVG />
    </NuxtLink>
  </nav>
</template>

<script setup lang="ts">
const route = useRoute()

const activeDock = computed(() => route.path)
</script>

<style scoped lang="scss">
.btm-nav {
  .icon {
    pointer-events: none;
    height: 40px;
    width: 40px;
  }

  .tooltip {
    display: flex;
  }
}
</style>