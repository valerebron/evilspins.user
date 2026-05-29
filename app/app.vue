<template>
  <NuxtRouteAnnouncer />
  <NuxtLayout @keydown.esc="resetFocus">
    <NuxtPage ref="pageContent" />
  </NuxtLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from '#imports'

const pageContent = ref<HTMLElement | null>(null)
const router = useRouter()

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
})

// Nettoyage des gestionnaires d'événement lors du démontage du composant
onUnmounted(() => {
  window.removeEventListener('keydown', resetFocus)
  window.removeEventListener('keydown', handleSearchShortcut)
})
</script>
