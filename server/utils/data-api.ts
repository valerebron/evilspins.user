import type { H3Event } from 'h3'

const ABSOLUTE_URL_RE = /^https?:\/\//i

export function getDataApiBaseUrl(event: H3Event): string {
  const config = useRuntimeConfig(event)
  const configured = (config.public.dataUrl || process.env.DATA_URL || '').trim()
  if (!configured) {
    throw createError({
      statusCode: 500,
      statusMessage: 'DATA_URL is not configured',
    })
  }

  return configured.endsWith('/') ? configured : `${configured}/`
}

export function toDataApiUrl(event: H3Event, pathname: string, query?: URLSearchParams): string {
  const baseUrl = getDataApiBaseUrl(event)
  const cleanPath = pathname.startsWith('/') ? pathname.slice(1) : pathname
  const url = new URL(cleanPath, baseUrl)
  if (query) {
    url.search = query.toString()
  }
  return url.toString()
}

export function toAbsoluteMediaUrl(event: H3Event, value?: string | null): string {
  const mediaPath = (value || '').trim()
  if (!mediaPath) return ''
  if (ABSOLUTE_URL_RE.test(mediaPath)) return mediaPath

  const baseUrl = getDataApiBaseUrl(event)
  const cleanPath = mediaPath.startsWith('/') ? mediaPath.slice(1) : mediaPath
  return new URL(cleanPath, baseUrl).toString()
}
