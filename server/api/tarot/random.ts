export default defineEventHandler(async (event) => {
  try {
    const randomCard = await $fetch(`${process.env.DATA_API_URL}/tarots/random`)
    return randomCard
  } catch (error) {
    console.error('Error fetching random tarot:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch random tarot'
    })
  }
})
