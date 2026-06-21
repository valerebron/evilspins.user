let probeContext: AudioContext | null = null

const getProbeContext = () => {
  if (!process.client) return null

  if (!probeContext) {
    const ContextCtor = window.AudioContext || (window as any).webkitAudioContext
    if (!ContextCtor) {
      return null
    }

    probeContext = new ContextCtor()
  }

  return probeContext
}

export const canAutoplayNow = async () => {
  const context = getProbeContext()
  if (!context) return false

  if (context.state === 'running') {
    return true
  }

  try {
    await context.resume()
  } catch {
    return false
  }

  return context.state === 'running'
}

export const requestAutoplayUnlock = async () => {
  return await canAutoplayNow()
}

export const useAutoplayGate = () => {
  return {
    canAutoplayNow,
    requestAutoplayUnlock,
  }
}
