class Sampler {
  public audioContext: AudioContext = new AudioContext()
  public gainNode: GainNode = new GainNode(this.audioContext)

  public audioBuffer: AudioBuffer | null = null
  public audioBufferReversed: AudioBuffer | null = null
  public audioSource: AudioBufferSourceNode | null = null

  public duration: number = 0
  public isReversed: boolean = false
  public currentSpeed: number = 0
  private stopTimeoutId: number | null = null // ID du setTimeout pour annuler l'arrêt

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

  play(offset = 0, withAcceleration = true) {
    // Annuler le timeout d'arrêt programmé s'il existe
    if (this.stopTimeoutId !== null) {
      clearTimeout(this.stopTimeoutId)
      this.stopTimeoutId = null
    }

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

    // Accélération progressive si demandé
    if (withAcceleration) {
      const currentTime = this.audioContext.currentTime
      const accelerationDuration = 1.5

      // Commencer à une vitesse très faible
      this.audioSource.playbackRate.value = 0.001

      // Accélérer progressivement jusqu'à la vitesse normale
      this.audioSource.playbackRate.linearRampToValueAtTime(
        1.0,
        currentTime + accelerationDuration
      )

      this.currentSpeed = 1.0
    } else {
      // Sans accélération, vitesse normale immédiate
      this.audioSource.playbackRate.value = 1.0
      this.currentSpeed = 1.0
    }
  }

  updateSpeed(speed: number, isReversed: boolean, secondsPlayed: number) {
    // Annuler le timeout d'arrêt programmé s'il existe (quand on relance pendant une décélération)
    if (this.stopTimeoutId !== null) {
      clearTimeout(this.stopTimeoutId)
      this.stopTimeoutId = null
    }

    if (!this.audioSource) {
      return
    }

    // Protection anti "mal aux oreilles" : on bride les vitesses extrêmes
    // (le clamp côté Disc est la vraie limite, mais on met une sécurité ici aussi)
    const MAX_RATE = 3.5
    const clampedSpeed = Math.max(-MAX_RATE, Math.min(MAX_RATE, speed))

    // Mettre à jour la vitesse actuelle
    this.currentSpeed = clampedSpeed

    if (isReversed !== this.isReversed) {
      this.changeDirection(isReversed, secondsPlayed)
    }

    const { currentTime } = this.audioContext
    const speedAbsolute = Math.abs(clampedSpeed)

    this.audioSource.playbackRate.cancelScheduledValues(currentTime)
    this.audioSource.playbackRate.linearRampToValueAtTime(
      Math.max(0.001, speedAbsolute),
      currentTime
    )
  }

  pause() {
    // Annuler le timeout d'arrêt programmé s'il existe
    if (this.stopTimeoutId !== null) {
      clearTimeout(this.stopTimeoutId)
      this.stopTimeoutId = null
    }

    if (!this.audioSource) {
      return
    }

    this.audioSource.stop()
  }

  pauseWithDeceleration(duration = 1.5) {
    if (!this.audioSource) {
      return
    }

    const currentTime = this.audioContext.currentTime

    // Réduire progressivement la vitesse de lecture
    this.audioSource.playbackRate.cancelScheduledValues(currentTime)
    this.audioSource.playbackRate.linearRampToValueAtTime(
      0.001,
      currentTime + duration
    )

    // Arrêter l'audio après la décélération
    this.stopTimeoutId = setTimeout(() => {
      if (this.audioSource) {
        this.audioSource.stop()
      }
      this.stopTimeoutId = null
    }, duration * 1000) as unknown as number

    // Mettre à jour la vitesse actuelle
    this.currentSpeed = 0
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

    // Protection supplémentaire contre les vitesses qui font mal aux oreilles
    const MAX_RATE = 3.5
    const clampedRate = Math.max(-MAX_RATE, Math.min(MAX_RATE, rate))

    const currentTime = this.audioContext.currentTime
    this.audioSource.playbackRate.cancelScheduledValues(currentTime)
    this.audioSource.playbackRate.linearRampToValueAtTime(
      Math.max(0.001, Math.abs(clampedRate)),
      currentTime + 0.05
    )

    // Mettre à jour la vitesse actuelle
    this.currentSpeed = clampedRate
  }
}

export default Sampler
