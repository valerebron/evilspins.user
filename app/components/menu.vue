<template>
  <nav class="menu">
    <ul>
      <li>
        <NuxtLink to="/">Accueil</NuxtLink>
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
    })
})
</script>

<style lang="scss">
.menu {
  width: 100%;
  position: fixed;
  bottom: 0;
  display: flex;
  flex-direction: row;
  justify-content: center;
  padding: 24px 12px;
}

.menu ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: row;
  gap: 16px;
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