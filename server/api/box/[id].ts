import { toAbsoluteMediaUrl, toDataApiUrl } from '../../utils/data-api'

type BoxCard = {
  url_audio?: string
  url_image?: string
  [key: string]: unknown
}

type BoxDetails = {
  cards?: BoxCard[]
  [key: string]: unknown
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Box id is required',
    })
  }

  try {
    const box = await $fetch<BoxDetails>(toDataApiUrl(event, `/api/box/${id}`))
    const cards = Array.isArray(box.cards) ? box.cards : []

    return {
      ...box,
      cards: cards.map((card) => ({
        ...card,
        url_audio: toAbsoluteMediaUrl(event, typeof card.url_audio === 'string' ? card.url_audio : ''),
        url_image: toAbsoluteMediaUrl(event, typeof card.url_image === 'string' ? card.url_image : ''),
      })),
    }
  } catch (error) {
    console.error('Error fetching box by id:', error)
    throw createError({
      statusCode: 404,
      statusMessage: 'Box not found',
    })
  }
})
