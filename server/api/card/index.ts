export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const page = parseInt(query.page as string) || 1
    const limit = parseInt(query.limit as string) || 50

    const response = await $fetch(`${process.env.DATA_URL}api/card?page=${page}&limit=${limit}`)

    // Préfixer les URLs avec DATA_URL pour chaque carte
    const processedCards = response.data.map((card: any) => {
      if (card.url_audio) {
        card.url_audio = `${process.env.DATA_URL}${card.url_audio}`
      }
      if (card.url_image) {
        card.url_image = `${process.env.DATA_URL}${card.url_image}`
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
