export interface Card {
  url_audio: string
  url_image: string
  blurhash: string
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
}

export type Suit = '♠' | '♣' | '♦' | '♥'
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'V' | 'D' | 'R'
