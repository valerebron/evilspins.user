export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const sourceUrl = String(query.url || '')

  if (!sourceUrl) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing image URL',
    })
  }

  let targetUrl = sourceUrl
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = `${process.env.DATA_URL}${targetUrl.replace(/^\//, '')}`
  }

  const upstream = await fetch(targetUrl)
  if (!upstream.ok) {
    throw createError({
      statusCode: 502,
      statusMessage: `Failed to fetch image (${upstream.status})`,
    })
  }

  setHeader(event, 'content-type', upstream.headers.get('content-type') || 'application/octet-stream')
  setHeader(event, 'cache-control', upstream.headers.get('cache-control') || 'public, max-age=3600')

  return Buffer.from(await upstream.arrayBuffer())
})
