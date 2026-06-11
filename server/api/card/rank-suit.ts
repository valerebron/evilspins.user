export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const params = new URLSearchParams()

  if (query.timestamp) {
    params.set('timestamp', String(query.timestamp))
  }
  if (query.date) {
    params.set('date', String(query.date))
  }
  if (query.year) {
    params.set('year', String(query.year))
  }
  if (query.month) {
    params.set('month', String(query.month))
  }
  if (query.day) {
    params.set('day', String(query.day))
  }
  if (query.hour) {
    params.set('hour', String(query.hour))
  }

  const url = `${process.env.DATA_URL}api/card/rank-suit${params.toString() ? `?${params.toString()}` : ''}`

  try {
    return await $fetch(url)
  } catch (error) {
    console.error('Error fetching rank and suit:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch rank and suit'
    })
  }
})
