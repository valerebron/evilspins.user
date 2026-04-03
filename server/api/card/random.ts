export default defineEventHandler(async (event) => {
  try {
    const randomCard = await $fetch(`${process.env.DATA_URL}api/card/random`)
    
    // Préfixer les URLs avec DATA_URL
    if (randomCard.url_audio) {
      randomCard.url_audio = `${process.env.DATA_URL}${randomCard.url_audio}`
    }
    if (randomCard.url_image) {
      randomCard.url_image = `${process.env.DATA_URL}${randomCard.url_image}`
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
