<template>
  <nav class="menu" aria-label="Navigation principale">
    <ul>
      <li>
        <NuxtLink to="/">random</NuxtLink>
      </li>

      <li v-for="route in rootPages" :key="route.path">
        <NuxtLink :to="route.path">
          {{ route.name }}
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>

<script setup lang="ts">
const router = useRouter()

const rootPages = computed(() => {
  return router.getRoutes()
    .filter(r => {
      // uniquement pages du type "/xxx" (pas "/xxx/yyy")
      return r.path.split('/').filter(Boolean).length === 1
        && !r.path.includes(':') // exclure dynamiques si besoin
        && r.path !== '/'
        && r.meta?.inMenu !== false
    })
})
</script>

<style lang="scss">
.menu {
  position: fixed;
  right: 12px;
  bottom: 12px;
  display: flex;
  padding: 12px 14px;
  z-index: 30;
  border: 1px solid rgba(38, 38, 38, 0.18);
  border-radius: 12px;
  background-color: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(12px);
}

.menu ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.menu a {
  text-decoration: none;
  color: #262626;
  font-weight: 500;
}

.menu a.router-link-active {
  font-weight: 700;
}
</style>