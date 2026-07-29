import { toAbsoluteMediaUrl, toDataApiUrl } from '../../utils/data-api'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const limit = parseInt(query.limit as string) || 10
    const params = new URLSearchParams({ limit: String(limit) })
    const cards = await $fetch<Array<Record<string, unknown>>>(toDataApiUrl(event, '/api/card/latest', params))

    const processedCards = cards.map((card) => {
      if (card.url_audio) {
        card.url_audio = toAbsoluteMediaUrl(event, String(card.url_audio))
      }
      if (card.url_image) {
        card.url_image = toAbsoluteMediaUrl(event, String(card.url_image))
      }
      return card
    })

    return processedCards
  } catch (error) {
    console.error('Error fetching latest cards:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch latest cards',
    })
  }
})
