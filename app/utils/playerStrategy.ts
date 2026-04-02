import type { Card } from '~~/types/types'

export const isTarotCard = (card?: Card) => {
  return card?.start !== undefined
}
