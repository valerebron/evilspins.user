export interface Card {
  url_audio: string
  url_image?: string
  blurhash?: string
  year: number
  month: string
  day: string
  hour: string
  artist: string
  title: string
  esid: string
  slug: string
  createdAt: Date
  suit?: Suit
  rank?: Rank
  start?: number
  box_position?: number
  box_side?: string | null
}

export interface BoxFaceColorMap {
  A?: string
  B?: string
  [side: string]: string | undefined
}

export interface BoxQuoteSide {
  author?: string
  auhor?: string
  [line: string]: string | undefined
}

export interface BoxQuoteMap {
  A?: BoxQuoteSide
  B?: BoxQuoteSide
  [side: string]: BoxQuoteSide | undefined
}

export interface BoxSummary {
  id: string
  name: string
  artists: Record<string, unknown>
  color?: BoxFaceColorMap
  cover_front?: string | null
  cover_back?: string | null
  card_count: number
}

export interface BoxDetails {
  id: string
  name: string
  artists: Record<string, unknown>
  color?: BoxFaceColorMap
  quote?: BoxQuoteMap
  cover_front?: string | null
  cover_back?: string | null
  cards: Card[]
}

export type Suit = '♠' | '♣' | '♦' | '♥'
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'V' | 'D' | 'R'
