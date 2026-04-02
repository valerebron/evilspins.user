export default defineEventHandler(async (event) => {
  try {
    const randomCard = await $fetch(`${process.env.DATA_API_URL}/card/random`)
    return randomCard
  } catch (error) {
    console.error('Error fetching random card:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch random card'
    })
  }
})
