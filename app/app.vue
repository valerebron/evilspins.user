<template>
  <NuxtRouteAnnouncer />
  <NuxtLayout @keydown.esc="resetFocus">
    <NuxtPage ref="pageContent" />
  </NuxtLayout>

  <Transition name="splash" @after-leave="markSplashDone">
    <div v-if="isSplashRenderable && showSplash" class="splash-screen" aria-label="Chargement" role="status">
      <object class="splash-logo" data="/logo.svg" type="image/svg+xml" aria-label="Logo Evilspins" />
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from '#imports'
import { useSplashScreen } from '~/composables/useSplashScreen'

const pageContent = ref<HTMLElement | null>(null)
const router = useRouter()
const { initializeSplashSession, markSplashDone, markSplashPending } = useSplashScreen()
const showSplash = ref(false)
const isSplashRenderable = ref(false)

let splashTimeout: ReturnType<typeof setTimeout> | null = null

const resetFocus = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    // On déplace le focus sur l'élément racine
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }

    // On force le focus sur le body
    document.body.focus()
  }
}

const handleSearchShortcut = (event: KeyboardEvent) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    router.push('/search')
  }
}

// Ajout des gestionnaires d'événement au montage du composant
onMounted(() => {
  window.addEventListener('keydown', resetFocus)
  window.addEventListener('keydown', handleSearchShortcut)

  const hasSeenSplashInSession = initializeSplashSession()
  isSplashRenderable.value = true

  if (hasSeenSplashInSession) {
    markSplashDone()
    return
  }

  markSplashPending()
  showSplash.value = true

  // Affiche le logo au premier chargement, puis masque l'overlay.
  splashTimeout = setTimeout(() => {
    showSplash.value = false
  }, 2500)
})

// Nettoyage des gestionnaires d'événement lors du démontage du composant
onUnmounted(() => {
  window.removeEventListener('keydown', resetFocus)
  window.removeEventListener('keydown', handleSearchShortcut)

  if (splashTimeout) {
    clearTimeout(splashTimeout)
  }
})
</script>

<style scoped lang="scss">
.splash-screen {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
}

.splash-logo {
  width: min(55vw, 420px);
  max-width: 85vw;
  max-height: 60vh;
  object-fit: contain;
}

.splash-enter-active,
.splash-leave-active {
  transition: opacity 350ms ease;
}

.splash-enter-from,
.splash-leave-to {
  opacity: 0;
}
</style>
