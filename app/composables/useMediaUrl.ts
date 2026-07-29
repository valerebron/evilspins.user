const ABSOLUTE_OR_INLINE_RE = /^(https?:\/\/|blob:|data:)/i

export function useMediaUrl() {
  const runtimeConfig = useRuntimeConfig()
  const dataBase = (runtimeConfig.public.dataUrl || '').trim()
  const normalizedBase = dataBase ? (dataBase.endsWith('/') ? dataBase : `${dataBase}/`) : ''

  const resolveMediaUrl = (value?: string | null) => {
    const media = (value || '').trim()
    if (!media) return ''
    if (ABSOLUTE_OR_INLINE_RE.test(media)) return media

    const normalizedPath = media.startsWith('/') ? media.slice(1) : media

    if (normalizedBase) {
      return new URL(normalizedPath, normalizedBase).toString()
    }

    if (import.meta.client && typeof window !== 'undefined') {
      return new URL(media, window.location.origin).toString()
    }

    return media
  }

  return { resolveMediaUrl }
}
