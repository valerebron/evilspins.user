import { toAbsoluteMediaUrl, toDataApiUrl } from '../../utils/data-api'

export default defineEventHandler(async (event) => {
  try {
    const randomCard = await $fetch<Record<string, unknown>>(toDataApiUrl(event, '/api/card/random'))

    if (randomCard.url_audio) {
      randomCard.url_audio = toAbsoluteMediaUrl(event, String(randomCard.url_audio))
    }
    if (randomCard.url_image) {
      randomCard.url_image = toAbsoluteMediaUrl(event, String(randomCard.url_image))
    }

    return randomCard
  } catch (error) {
    console.error('Error fetching random card:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch random card'
    })
  }
})
