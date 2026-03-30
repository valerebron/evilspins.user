<template>
  <div class="min-h-screen dark:bg-neutral-900" @keydown.esc="resetFocus">
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage ref="pageContent" />
    </NuxtLayout>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const pageContent = ref<HTMLElement | null>(null)

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

// Ajout du gestionnaire d'événement au montage du composant
onMounted(() => {
  window.addEventListener('keydown', resetFocus)
})

// Nettoyage du gestionnaire d'événement lors du démontage du composant
onUnmounted(() => {
  window.removeEventListener('keydown', resetFocus)
})
</script>
