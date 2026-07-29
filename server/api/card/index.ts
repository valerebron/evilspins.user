import { toAbsoluteMediaUrl, toDataApiUrl } from '../../utils/data-api'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const page = parseInt(query.page as string) || 1
    const limit = parseInt(query.limit as string) || 500
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    })

    for (const key of ['search', 'suit', 'rank', 'year'] as const) {
      const value = query[key]
      if (typeof value === 'string' && value.trim()) {
        params.set(key, value.trim())
      }
    }

    const response = await $fetch<{ data: Array<Record<string, unknown>>; pagination?: Record<string, unknown> }>(
      toDataApiUrl(event, '/api/card', params),
    )

    const processedCards = (response.data || []).map((card) => {
      if (card.url_audio) {
        card.url_audio = toAbsoluteMediaUrl(event, String(card.url_audio))
      }
      if (card.url_image) {
        card.url_image = toAbsoluteMediaUrl(event, String(card.url_image))
      }
      return card
    })

    return {
      data: processedCards,
      pagination: response.pagination
    }
  } catch (error) {
    console.error('Error fetching all cards:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch all cards'
    })
  }
})
