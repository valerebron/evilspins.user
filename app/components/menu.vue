<template>
  <nav class="menu menu--desktop">
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

  <div class="menu-mobile">
    <button type="button" class="menu-mobile__trigger" aria-label="Ouvrir le menu" @click="openDialog">
      ...
    </button>

    <dialog ref="menuDialog" class="menu-mobile__dialog" @click="onDialogBackdropClick">
      <nav class="menu-mobile__content" aria-label="Menu mobile">
        <ul>
          <li>
            <NuxtLink to="/" @click="closeDialog">random</NuxtLink>
          </li>

          <li v-for="route in rootPages" :key="`mobile-${route.path}`">
            <NuxtLink :to="route.path" @click="closeDialog">
              {{ route.name }}
            </NuxtLink>
          </li>
        </ul>

        <button type="button" class="menu-mobile__close" @click="closeDialog">
          Fermer
        </button>
      </nav>
    </dialog>
  </div>
</template>

<script setup lang="ts">
const router = useRouter()
const menuDialog = ref<HTMLDialogElement | null>(null)

const openDialog = () => {
  menuDialog.value?.showModal()
}

const closeDialog = () => {
  menuDialog.value?.close()
}

const onDialogBackdropClick = (event: MouseEvent) => {
  if (event.target === menuDialog.value) {
    closeDialog()
  }
}

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

.menu-mobile {
  display: none;
}

@media (max-width: 768px) {
  .menu--desktop {
    display: none;
  }

  .menu-mobile {
    display: block;
  }

  .menu-mobile__trigger {
    position: fixed;
    right: 12px;
    bottom: 12px;
    z-index: 30;
    border: 1px solid #262626;
    background: #fff;
    color: #262626;
    font-size: 24px;
    line-height: 1;
    padding: 8px 12px;
    border-radius: 8px;
    cursor: pointer;
  }

  .menu-mobile__dialog {
    width: min(320px, calc(100vw - 24px));
    border: 0;
    border-radius: 12px;
    padding: 0;
  }

  .menu-mobile__dialog::backdrop {
    background: rgba(0, 0, 0, 0.35);
  }

  .menu-mobile__content {
    padding: 20px;
  }

  .menu-mobile__content ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .menu-mobile__content a {
    text-decoration: none;
    color: #262626;
    font-weight: 500;
    font-size: 22px;
  }

  .menu-mobile__content a.router-link-active {
    font-weight: 700;
  }

  .menu-mobile__close {
    margin-top: 16px;
    border: 1px solid #262626;
    background: #fff;
    color: #262626;
    font-weight: 500;
    border-radius: 8px;
    padding: 8px 12px;
    cursor: pointer;
  }
}
</style>