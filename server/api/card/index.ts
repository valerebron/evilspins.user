export default defineEventHandler(async (event) => {
  try {
    const cards = await $fetch(`${process.env.DATA_URL}api/card`)
    
    // Préfixer les URLs avec DATA_URL pour chaque carte
    return cards.map((card: any) => {
      if (card.url_audio) {
        card.url_audio = `${process.env.DATA_URL}${card.url_audio}`
      }
      if (card.url_image) {
        card.url_image = `${process.env.DATA_URL}${card.url_image}`
      }
      return card
    })
  } catch (error) {
    console.error('Error fetching all cards:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch all cards'
    })
  }
})
