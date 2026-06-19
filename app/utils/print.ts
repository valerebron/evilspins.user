import type { Card } from '~~/types/types'

export const A4_LANDSCAPE_MM = {
  width: 297,
  height: 210,
} as const

export const LETTER_LANDSCAPE_MM = {
  width: 279.4,
  height: 215.9,
} as const

export const PAPER_FORMATS = {
  a4: {
    label: 'A4 paysage',
    width: A4_LANDSCAPE_MM.width,
    height: A4_LANDSCAPE_MM.height,
  },
  letter: {
    label: 'US Letter paysage',
    width: LETTER_LANDSCAPE_MM.width,
    height: LETTER_LANDSCAPE_MM.height,
  },
} as const

export type PaperFormatId = keyof typeof PAPER_FORMATS

export interface PaperDimensions {
  width: number
  height: number
}

export const CARD_MM = {
  width: 53.98,
  height: 85.6,
} as const

export const BLEED_MM = 3
export const IMPOSITION_ROWS = 2
export const IMPOSITION_COLS = 5
export const CARDS_PER_SHEET = IMPOSITION_ROWS * IMPOSITION_COLS

export type BackAlignmentMode = 'mirror' | 'aligned'

export interface ImpositionSlot {
  index: number
  row: number
  col: number
  xMm: number
  yMm: number
}

export interface PrintCardItem extends Card {
  keywords?: string[]
  tags?: string[]
}

export const mmToPt = (mm: number): number => (mm * 72) / 25.4

export const getPaperDimensions = (paperFormat: PaperFormatId = 'a4'): PaperDimensions => {
  const format = PAPER_FORMATS[paperFormat]
  return {
    width: format.width,
    height: format.height,
  }
}

export const getImpositionBlock = (pageDimensions: PaperDimensions = A4_LANDSCAPE_MM) => {
  const width = IMPOSITION_COLS * CARD_MM.width
  const height = IMPOSITION_ROWS * CARD_MM.height
  return {
    width,
    height,
    x: (pageDimensions.width - width) / 2,
    y: (pageDimensions.height - height) / 2,
  }
}

export const getImpositionSlots = (pageDimensions: PaperDimensions = A4_LANDSCAPE_MM): ImpositionSlot[] => {
  const block = getImpositionBlock(pageDimensions)
  const slots: ImpositionSlot[] = []

  for (let row = 0; row < IMPOSITION_ROWS; row += 1) {
    for (let col = 0; col < IMPOSITION_COLS; col += 1) {
      const index = row * IMPOSITION_COLS + col
      slots.push({
        index,
        row,
        col,
        xMm: block.x + col * CARD_MM.width,
        yMm: block.y + row * CARD_MM.height,
      })
    }
  }

  return slots
}

export const getSheetCount = (totalCards: number): number => {
  return Math.max(1, Math.ceil(totalCards / CARDS_PER_SHEET))
}

export const getCardsForSheet = (cards: PrintCardItem[], sheetIndex: number): PrintCardItem[] => {
  const start = sheetIndex * CARDS_PER_SHEET
  return cards.slice(start, start + CARDS_PER_SHEET)
}

export const mapCardsForBack = (
  cards: PrintCardItem[],
  mode: BackAlignmentMode,
): (PrintCardItem | null)[] => {
  const result: (PrintCardItem | null)[] = Array.from({ length: CARDS_PER_SHEET }, () => null)

  if (mode === 'aligned') {
    cards.forEach((card, index) => {
      result[index] = card
    })
    return result
  }

  for (let row = 0; row < IMPOSITION_ROWS; row += 1) {
    for (let col = 0; col < IMPOSITION_COLS; col += 1) {
      const frontIndex = row * IMPOSITION_COLS + col
      const backCol = IMPOSITION_COLS - 1 - col
      const backIndex = row * IMPOSITION_COLS + backCol
      result[backIndex] = cards[frontIndex] ?? null
    }
  }

  return result
}

export const toSearchableText = (card: PrintCardItem): string => {
  const keywords = Array.isArray(card.keywords) ? card.keywords.join(' ') : ''
  const tags = Array.isArray(card.tags) ? card.tags.join(' ') : ''
  return [card.title, card.artist, keywords, tags].filter(Boolean).join(' ').toLowerCase()
}
