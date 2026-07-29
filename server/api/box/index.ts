import { toDataApiUrl } from '../../utils/data-api'

export default defineEventHandler(async (event) => {
  try {
    return await $fetch(toDataApiUrl(event, '/api/box'))
  } catch (error) {
    console.error('Error fetching boxes:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch boxes',
    })
  }
})
