const SPLASH_FINISHED_EVENT = 'splash-finished'
const SPLASH_SESSION_KEY = 'evilspins-splash-seen'

type SplashAwareWindow = Window & {
  __evilspinsSplashDone?: boolean
}

const readSessionCookie = () => {
  if (!import.meta.client) {
    return false
  }

  return document.cookie
    .split(';')
    .map(cookie => cookie.trim())
    .some(cookie => cookie === `${SPLASH_SESSION_KEY}=1`)
}

const writeSessionCookie = () => {
  if (!import.meta.client) {
    return
  }

  document.cookie = `${SPLASH_SESSION_KEY}=1; path=/; SameSite=Lax`
}

export const useSplashScreen = () => {
  const hasSeenSplashInSessionState = useState('splash-seen-session', () => false)
  const isSplashDone = useState('splash-done', () => false)

  const syncWindowFlag = () => {
    if (!import.meta.client) return
    const splashAwareWindow = window as SplashAwareWindow
    splashAwareWindow.__evilspinsSplashDone = isSplashDone.value
  }

  const markSplashPending = () => {
    isSplashDone.value = false
    syncWindowFlag()
  }

  const initializeSplashSession = () => {
    if (!import.meta.client) {
      return false
    }

    const hasSeenSplash = readSessionCookie()
    hasSeenSplashInSessionState.value = hasSeenSplash
    isSplashDone.value = hasSeenSplash
    syncWindowFlag()
    return hasSeenSplash
  }

  const markSplashDone = (dispatchEvent = true) => {
    isSplashDone.value = true
    hasSeenSplashInSessionState.value = true
    writeSessionCookie()

    syncWindowFlag()

    if (import.meta.client && dispatchEvent) {
      window.dispatchEvent(new CustomEvent(SPLASH_FINISHED_EVENT))
    }
  }

  const waitForSplashDone = () => {
    if (!import.meta.client || isSplashDone.value) {
      return Promise.resolve()
    }

    return new Promise<void>((resolve) => {
      window.addEventListener(SPLASH_FINISHED_EVENT, () => resolve(), { once: true })
    })
  }

  if (import.meta.client) {
    syncWindowFlag()
  }

  return {
    isSplashDone,
    hasSeenSplashInSession: computed(() => hasSeenSplashInSessionState.value),
    initializeSplashSession,
    markSplashPending,
    markSplashDone,
    waitForSplashDone,
  }
}