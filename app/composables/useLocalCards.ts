import { computed } from 'vue'
import type { Card } from '~~/types/types'

const LOCAL_CARDS_STATE_KEY = 'local-cards-state'
const LOCAL_CARDS_STORAGE_KEY = 'evilspins:local-cards:v1'

export const useLocalCards = () => {
  const localCardsState = useState<Card[]>(LOCAL_CARDS_STATE_KEY, () => [])
  const localCardsLoadedState = useState<boolean>('local-cards-loaded-state', () => false)

  const normalizeCard = (input: unknown): Card | null => {
    if (!input || typeof input !== 'object') {
      return null
    }

    const raw = input as Partial<Card>
    const slug = raw.slug || ''
    if (!slug) {
      return null
    }

    return {
      url_audio: raw.url_audio || '',
      url_image: raw.url_image,
      blurhash: raw.blurhash || '',
      year: Number(raw.year || new Date().getFullYear()),
      month: String(raw.month || '01'),
      day: String(raw.day || '01'),
      hour: String(raw.hour || '00'),
      artist: String(raw.artist || ''),
      title: String(raw.title || ''),
      esid: String(raw.esid || `local-${slug}`),
      slug,
      createdAt: raw.createdAt ? new Date(raw.createdAt as unknown as string) : new Date(),
      suit: raw.suit,
      rank: raw.rank,
      start: raw.start,
      box_position: raw.box_position,
      box_side: raw.box_side,
    }
  }

  const saveToStorage = () => {
    if (import.meta.server) {
      return
    }

    try {
      window.localStorage.setItem(LOCAL_CARDS_STORAGE_KEY, JSON.stringify(localCardsState.value))
    } catch (error) {
      console.error('Unable to persist local cards in localStorage:', error)
    }
  }

  const ensureLoaded = () => {
    if (import.meta.server || localCardsLoadedState.value) {
      return
    }

    localCardsLoadedState.value = true

    try {
      const serialized = window.localStorage.getItem(LOCAL_CARDS_STORAGE_KEY)
      if (!serialized) {
        return
      }

      const parsed = JSON.parse(serialized)
      if (!Array.isArray(parsed)) {
        return
      }

      localCardsState.value = parsed
        .map(normalizeCard)
        .filter((card): card is Card => Boolean(card))
    } catch (error) {
      console.error('Unable to load local cards from localStorage:', error)
      localCardsState.value = []
    }
  }

  const addLocalCard = (card: Card) => {
    ensureLoaded()

    const slug = card.slug || ''
    if (!slug) {
      return
    }

    const nextCards = localCardsState.value.filter(existing => existing.slug !== slug)
    localCardsState.value = [card, ...nextCards]
    saveToStorage()
  }

  const updateLocalCard = (slug: string, patch: Partial<Card>) => {
    ensureLoaded()

    if (!slug) {
      return
    }

    const nextCards = localCardsState.value.map((card) => {
      if (card.slug !== slug) {
        return card
      }

      return {
        ...card,
        ...patch,
        slug: card.slug,
      }
    })

    localCardsState.value = nextCards
    saveToStorage()
  }

  const deleteLocalCard = (slug: string) => {
    ensureLoaded()

    if (!slug) {
      return
    }

    localCardsState.value = localCardsState.value.filter(card => card.slug !== slug)
    saveToStorage()
  }

  const clearLocalCards = () => {
    ensureLoaded()
    localCardsState.value = []

    if (!import.meta.server) {
      window.localStorage.removeItem(LOCAL_CARDS_STORAGE_KEY)
    }
  }

  return {
    ensureLoaded,
    localCards: computed(() => localCardsState.value),
    addLocalCard,
    updateLocalCard,
    deleteLocalCard,
    clearLocalCards,
  }
}
