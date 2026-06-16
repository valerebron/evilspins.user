const openCardId = ref<string | null>(null)

export function useCardOpenState() {
  const openCard = (cardId: string) => {
    openCardId.value = cardId
  }

  const closeCard = (cardId: string) => {
    if (openCardId.value === cardId) {
      openCardId.value = null
    }
  }

  return {
    openCardId: readonly(openCardId),
    openCard,
    closeCard,
  }
}
