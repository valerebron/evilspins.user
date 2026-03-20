class Sampler {
  public audioContext: AudioContext = new AudioContext()
  public gainNode: GainNode = new GainNode(this.audioContext)

  public audioBuffer: AudioBuffer | null = null
  public audioBufferReversed: AudioBuffer | null = null
  public audioSource: AudioBufferSourceNode | null = null

  public duration: number = 0
  public isReversed: boolean = false
  public currentSpeed: number = 0

  constructor() {
    this.gainNode.connect(this.audioContext.destination)
  }

  async getAudioBuffer(audioUrl: string) {
    const response = await fetch(audioUrl)
    const arrayBuffer = await response.arrayBuffer()

    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer)

    return audioBuffer
  }

  async loadTrack(audioUrl: string) {
    this.audioBuffer = await this.getAudioBuffer(audioUrl)
    this.audioBufferReversed = this.getReversedAudioBuffer(this.audioBuffer)

    this.duration = this.audioBuffer.duration
  }

  getReversedAudioBuffer(audioBuffer: AudioBuffer) {
    const bufferArray = audioBuffer.getChannelData(0).slice().reverse()

    const audioBufferReversed = this.audioContext.createBuffer(
      1,
      audioBuffer.length,
      audioBuffer.sampleRate
    )

    audioBufferReversed.getChannelData(0).set(bufferArray)

    return audioBufferReversed
  }

  changeDirection(isReversed: boolean, secondsPlayed: number) {
    // S'assurer que la position est dans les limites
    const safePosition = Math.max(0, Math.min(secondsPlayed, this.duration))
    this.isReversed = isReversed
    this.play(safePosition)
  }

  play(offset = 0) {
    this.pause()

    if (!this.audioBuffer || !this.audioBufferReversed) {
      return
    }

    const buffer = this.isReversed ? this.audioBufferReversed : this.audioBuffer

    // S'assurer que l'offset est dans les limites
    const safeOffset = Math.max(0, Math.min(offset, this.duration))
    const cueTime = this.isReversed ? this.duration - safeOffset : safeOffset

    this.audioSource = this.audioContext.createBufferSource()
    this.audioSource.buffer = buffer
    this.audioSource.loop = false

    this.audioSource.connect(this.gainNode)

    // S'assurer que le cueTime n'est pas négatif
    const startTime = Math.max(0, cueTime)
    this.audioSource.start(0, startTime)
  }

  updateSpeed(speed: number, isReversed: boolean, secondsPlayed: number) {
    if (!this.audioSource) {
      return
    }

    // Mettre à jour la vitesse actuelle
    this.currentSpeed = speed

    if (isReversed !== this.isReversed) {
      this.changeDirection(isReversed, secondsPlayed)
    }

    const { currentTime } = this.audioContext
    const speedAbsolute = Math.abs(speed)

    this.audioSource.playbackRate.cancelScheduledValues(currentTime)
    this.audioSource.playbackRate.linearRampToValueAtTime(
      Math.max(0.001, speedAbsolute),
      currentTime
    )
  }

  pause() {
    if (!this.audioSource) {
      return
    }

    this.audioSource.stop()
  }

  /**
   * Inverse la direction de lecture
   * @returns La nouvelle direction (true = inversé, false = normal)
   */
  reverse(secondsPlayed: number = 0): boolean {
    if (!this.audioBuffer) return false

    // Inverser la direction
    this.isReversed = !this.isReversed

    // Si on a une position, on relance la lecture à cette position
    if (secondsPlayed > 0) {
      // S'assurer que la position est dans les limites
      const safePosition = Math.max(0, Math.min(secondsPlayed, this.duration))
      this.play(safePosition)
    }

    return this.isReversed
  }

  mute() {
    this.gainNode.gain.value = 0
  }

  unmute() {
    this.gainNode.gain.value = 1
  }

  /**
   * Définit le taux de lecture (vitesse de lecture)
   * @param rate Taux de lecture (1.0 = vitesse normale, 0.5 = moitié de vitesse, 2.0 = double vitesse, etc.)
   */
  setPlaybackRate(rate: number) {
    if (!this.audioSource) return

    const currentTime = this.audioContext.currentTime
    this.audioSource.playbackRate.cancelScheduledValues(currentTime)
    this.audioSource.playbackRate.linearRampToValueAtTime(
      Math.max(0.001, Math.abs(rate)), // Éviter les valeurs négatives ou nulles
      currentTime + 0.05 // Petit délai pour éviter les clics
    )

    // Mettre à jour la vitesse actuelle
    this.currentSpeed = rate
  }
}

export default Sampler
