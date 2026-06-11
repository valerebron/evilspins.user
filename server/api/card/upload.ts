import { proxyRequest } from 'h3'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const dataUrl = config.public.dataUrl || process.env.DATA_URL

  const target = new URL('/api/card/upload', dataUrl).toString()

  return proxyRequest(event, target)
})
