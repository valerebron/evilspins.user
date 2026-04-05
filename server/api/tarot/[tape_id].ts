export default defineEventHandler(async (event) => {
  try {
    const tapeId = getRouterParam(event, 'tape_id')?.slice(0, -1)
    const side = getRouterParam(event, 'tape_id')?.slice(-1)
console.log(`${process.env.DATA_URL}api/tarot/by-tape-side?tapeId=${tapeId}&side=${side}`)
    return await $fetch(`${process.env.DATA_URL}api/tarot/by-tape-side?tapeId=${tapeId}&side=${side}`)
  } catch (error) {
    console.error('Error fetching random tarot:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch random tarot'
    })
  }
})
