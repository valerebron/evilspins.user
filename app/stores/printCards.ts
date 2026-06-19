import type { PrintCardItem } from '~/utils/print'

export const usePrintCardsStore = defineStore('printCards', {
  state: () => ({
    selectedBySlug: {} as Record<string, PrintCardItem>,
    selectedOrder: [] as string[],
  }),
  getters: {
    selectedCount: (state): number => state.selectedOrder.length,
    selectedCards: (state): PrintCardItem[] => {
      return state.selectedOrder
        .map((slug) => state.selectedBySlug[slug])
        .filter((card): card is PrintCardItem => Boolean(card))
    },
    selectedSlugs: (state): string[] => state.selectedOrder,
  },
  actions: {
    isSelected(slug: string): boolean {
      return Boolean(this.selectedBySlug[slug])
    },
    toggleCard(card: PrintCardItem) {
      if (!card.slug) {
        return
      }

      if (this.selectedBySlug[card.slug]) {
        delete this.selectedBySlug[card.slug]
        this.selectedOrder = this.selectedOrder.filter((slug) => slug !== card.slug)
        return
      }

      this.selectedBySlug[card.slug] = card
      this.selectedOrder.push(card.slug)
    },
    addMany(cards: PrintCardItem[]) {
      cards.forEach((card) => {
        if (!card.slug || this.selectedBySlug[card.slug]) {
          return
        }
        this.selectedBySlug[card.slug] = card
        this.selectedOrder.push(card.slug)
      })
    },
    removeMany(slugs: string[]) {
      slugs.forEach((slug) => {
        delete this.selectedBySlug[slug]
      })
      this.selectedOrder = this.selectedOrder.filter((slug) => !slugs.includes(slug))
    },
    clear() {
      this.selectedBySlug = {}
      this.selectedOrder = []
    },
  },
})
