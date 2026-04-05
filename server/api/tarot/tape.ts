export default defineEventHandler(async (event) => {
  try {
    return await $fetch(`${process.env.DATA_URL}api/tarot/tape`)
  } catch (error) {
    console.error('Error fetching random tarot:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch random tarot'
    })
  }
})
