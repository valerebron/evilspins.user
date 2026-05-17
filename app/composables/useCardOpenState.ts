const openCardId = ref<string | null>(null)
const allowMultipleOpen = ref(false)

export function useCardOpenState() {
  const openCard = (cardId: string) => {
    if (!allowMultipleOpen.value) {
      openCardId.value = cardId
    }
  }

  const closeCard = (cardId: string) => {
    if (openCardId.value === cardId) {
      openCardId.value = null
    }
  }

  const isCardOpen = (cardId: string) => {
    if (allowMultipleOpen.value) {
      return true
    }
    return openCardId.value === cardId
  }

  const setAllowMultipleOpen = (allow: boolean) => {
    allowMultipleOpen.value = allow
  }

  return {
    openCardId: readonly(openCardId),
    openCard,
    closeCard,
    isCardOpen,
    setAllowMultipleOpen,
  }
}
