export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const limit = parseInt(query.limit as string) || 10
    const cards = await $fetch<any[]>(`${process.env.DATA_URL}api/card/latest?limit=${limit}`)

    const processedCards = cards.map((card: any) => {
      if (card.url_audio) {
        card.url_audio = `${process.env.DATA_URL}${card.url_audio}`
      }
      if (card.url_image) {
        card.url_image = `${process.env.DATA_URL}${card.url_image}`
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
