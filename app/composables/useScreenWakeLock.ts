export const useScreenWakeLock = () => {
  let wakeLockSentinel: any = null

  const isSupported = () => {
    if (!process.client) return false
    return typeof (navigator as any).wakeLock?.request === 'function'
  }

  const requestWakeLock = async () => {
    if (!isSupported()) return false
    if (wakeLockSentinel) return true

    try {
      wakeLockSentinel = await (navigator as any).wakeLock.request('screen')
      wakeLockSentinel?.addEventListener?.('release', () => {
        wakeLockSentinel = null
      })
      return true
    } catch {
      wakeLockSentinel = null
      return false
    }
  }

  const releaseWakeLock = async () => {
    if (!wakeLockSentinel) return

    try {
      await wakeLockSentinel.release()
    } catch {
      // Ignored: some browsers can auto-release on visibility changes.
    } finally {
      wakeLockSentinel = null
    }
  }

  onUnmounted(() => {
    void releaseWakeLock()
  })

  return {
    isWakeLockSupported: isSupported,
    requestWakeLock,
    releaseWakeLock,
  }
}
