import type { Card } from '~~/types/types'

export const useMixCardsStore = defineStore('mixCards', {
  state: () => ({
    selectedBySlug: {} as Record<string, Card>,
    selectedOrder: [] as string[],
  }),
  getters: {
    selectedCount: (state): number => state.selectedOrder.length,
    selectedCards: (state): Card[] => {
      return state.selectedOrder
        .map((slug) => state.selectedBySlug[slug])
        .filter((card): card is Card => Boolean(card))
    },
  },
  actions: {
    setCards(cards: Card[]) {
      const nextBySlug: Record<string, Card> = {}
      const nextOrder: string[] = []

      cards.forEach((card) => {
        const slug = card.slug || ''
        if (!slug || nextBySlug[slug]) {
          return
        }

        nextBySlug[slug] = card
        nextOrder.push(slug)
      })

      this.selectedBySlug = nextBySlug
      this.selectedOrder = nextOrder
    },
    clear() {
      this.selectedBySlug = {}
      this.selectedOrder = []
    },
  },
})
