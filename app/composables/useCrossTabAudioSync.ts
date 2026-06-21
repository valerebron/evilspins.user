type CrossTabAudioEvent = {
  type: 'playing'
  tabId: string
  timestamp: number
}

const CHANNEL_NAME = 'evilspins-audio-sync'
const tabId = `${Date.now()}-${Math.random().toString(36).slice(2)}`

const listeners = new Set<(event: CrossTabAudioEvent) => void>()

let channel: BroadcastChannel | null = null

const getChannel = () => {
  if (!process.client || typeof BroadcastChannel === 'undefined') {
    return null
  }

  if (channel) {
    return channel
  }

  channel = new BroadcastChannel(CHANNEL_NAME)
  channel.onmessage = (message: MessageEvent<CrossTabAudioEvent>) => {
    const payload = message.data
    if (!payload || payload.tabId === tabId) {
      return
    }

    for (const listener of listeners) {
      listener(payload)
    }
  }

  return channel
}

export const announcePlaybackStarted = () => {
  const currentChannel = getChannel()
  if (!currentChannel) return

  currentChannel.postMessage({
    type: 'playing',
    tabId,
    timestamp: Date.now(),
  } satisfies CrossTabAudioEvent)
}

export const useCrossTabAudioPause = (onOtherTabPlayback: () => void) => {
  const currentChannel = getChannel()
  if (!currentChannel) {
    return () => {}
  }

  const listener = (event: CrossTabAudioEvent) => {
    if (event.type === 'playing') {
      onOtherTabPlayback()
    }
  }

  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}
