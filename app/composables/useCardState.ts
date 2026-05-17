import { ref, computed } from 'vue'

// État global pour suivre la carte actuellement ouverte
const openCardId = ref<string | null>(null)

// Flag pour permettre l'ouverture de plusieurs cartes (pour la future page studio/mix)
const allowMultipleCards = ref(false)

export function useCardState() {
  const setOpenCard = (cardId: string | null) => {
    if (!allowMultipleCards.value) {
      openCardId.value = cardId
    }
  }

  const isCardOpen = (cardId: string) => {
    return openCardId.value === cardId
  }

  const shouldHide = (cardId: string) => {
    // Si on permet plusieurs cartes, ne jamais cacher
    if (allowMultipleCards.value) return false
    // Sinon, cacher toutes les cartes sauf celle ouverte
    return openCardId.value !== null && openCardId.value !== cardId
  }

  const closeCard = () => {
    openCardId.value = null
  }

  const setAllowMultipleCards = (allow: boolean) => {
    allowMultipleCards.value = allow
  }

  return {
    openCardId: computed(() => openCardId.value),
    setOpenCard,
    isCardOpen,
    shouldHide,
    closeCard,
    setAllowMultipleCards,
    allowMultipleCards: computed(() => allowMultipleCards.value)
  }
}
