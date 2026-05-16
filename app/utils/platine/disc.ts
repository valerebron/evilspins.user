const TAU = Math.PI * 2

const targetFPS = 60
const RPS = 0.75
const RPM = RPS * 60

const RADIANS_PER_MINUTE = RPM * TAU
const RADIANS_PER_SECOND = RADIANS_PER_MINUTE / 60
const RADIANS_PER_MILLISECOND = RADIANS_PER_SECOND * 0.001

const ROTATION_SPEED = (TAU * RPS) / targetFPS

type Vector = {
  x: number
  y: number
}

type NumberArray = Array<number>

const average = (arr: NumberArray) => arr.reduce((memo, val) => memo + val, 0) / arr.length

// Limit array size by cutting off from the start
const limit = (arr: NumberArray, maxLength = 10) => {
  const deleteCount = Math.max(0, arr.length - maxLength)

  return arr.slice(deleteCount)
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max))

const distanceBetween = (vec1: Vector, vec2: Vector) => Math.hypot(vec2.x - vec1.x, vec2.y - vec1.y)

const getElementCenter = (el: HTMLElement): Vector => {
  const { left, top, width, height } = el.getBoundingClientRect()

  const x = left + width / 2
  const y = top + height / 2

  return { x, y }
}

const angleBetween = (vec1: Vector, vec2: Vector) => Math.atan2(vec2.y - vec1.y, vec2.x - vec1.x)

const angleDifference = (x: number, y: number) => Math.atan2(Math.sin(x - y), Math.cos(x - y))

type DiscProgress = {
  playbackSpeed: number
  isReversed: boolean
  secondsPlayed: number
  progress: number
}
class Disc {
  public el: HTMLElement

  private _playbackSpeed = 1
  private _duration = 0
  private _isDragging = false
  private _isPoweredOn = false

  private _center: Vector

  private _currentAngle = 0
  private _previousAngle = 0
  private _maxAngle = TAU

  public rafId: number | null = null

  public previousTimestamp: number

  private _draggingSpeeds: Array<number> = []
  private _draggingFrom: Vector = { x: 0, y: 0 }

  // Propriétés pour l'inertie
  private _inertiaVelocity: number = 0
  private _isInertiaActive: boolean = false
  private _basePlaybackSpeed: number = 1 // Vitesse de lecture normale
  private _inertiaFriction: number = 1 // Coefficient de frottement pour l'inertie (plus proche de 1 = plus long)
  private _lastDragVelocity: number = 0 // Dernière vitesse de drag
  private _lastDragTime: number = 0 // Dernier temps de drag
  private _inertiaAmplification: number = 25 // Facteur d'amplification de l'inertie
  private _previousDuration: number = 0 // Pour suivre les changements de durée

  public isReversed: boolean = false

  public callbacks = {
    onDragStart: (): void => {},
    onDragProgress: (): void => {},
    onDragEnded: (secondsPlayed: number): void => {},
    onStop: (): void => {},
    onLoop: (params: DiscProgress): void => {}
  }

  constructor(el: HTMLElement) {
    this.el = el

    this._center = getElementCenter(this.el)

    this.previousTimestamp = performance.now()

    this.onDragStart = this.onDragStart.bind(this)
    this.onDragProgress = this.onDragProgress.bind(this)
    this.onDragEnd = this.onDragEnd.bind(this)
    this.loop = this.loop.bind(this)

    this.init()
  }

  init() {
    // Ajout du style pour désactiver le comportement tactile par défaut
    this.el.style.touchAction = 'none'

    // Écouteurs pour la souris et le tactile
    this.el.addEventListener('pointerdown', this.onDragStart)
    this.el.addEventListener(
      'touchstart',
      (e) => {
        // Empêcher le défilement de la page
        e.preventDefault()
        this.onDragStart(e)
      },
      { passive: false }
    )
  }

  get playbackSpeed() {
    return this._playbackSpeed
  }

  set playbackSpeed(s) {
    this._draggingSpeeds.push(s)
    this._draggingSpeeds = limit(this._draggingSpeeds, 10)

    this._playbackSpeed = average(this._draggingSpeeds)
    // this._playbackSpeed = clamp(this._playbackSpeed, -4, 4)
  }

  get secondsPlayed() {
    return this._currentAngle / TAU / RPS
  }

  set isDragging(d) {
    this._isDragging = d
    this.el.classList.toggle('is-scratching', d)
  }

  get isDragging() {
    return this._isDragging
  }

  powerOn() {
    this._isPoweredOn = true
    this._basePlaybackSpeed = this.isReversed ? -1 : 1
    this.start()
  }

  powerOnWithAcceleration(duration = 1500) {
    this._isPoweredOn = true
    const targetSpeed = this.isReversed ? -1 : 1
    const startTime = performance.now()
    const startSpeed = 0

    const accelerate = (timestamp: number) => {
      const elapsed = timestamp - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Courbe d'easing pour un effet naturel (easeOutCubic inversé)
      const easeIn = 1 - Math.pow(1 - progress, 3)

      // Augmenter progressivement la vitesse
      this._basePlaybackSpeed = startSpeed + (targetSpeed - startSpeed) * easeIn

      if (progress < 1) {
        requestAnimationFrame(accelerate)
      } else {
        this._basePlaybackSpeed = targetSpeed
      }
    }

    this.start()
    requestAnimationFrame(accelerate)
  }

  powerOff() {
    this._isPoweredOn = false
    this._basePlaybackSpeed = 0
  }

  powerOffWithDeceleration(duration = 1500) {
    const startTime = performance.now()
    const startSpeed = this._basePlaybackSpeed

    const decelerate = (timestamp: number) => {
      const elapsed = timestamp - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Courbe d'easing pour un effet naturel (easeOutCubic)
      const easeOut = 1 - Math.pow(1 - progress, 3)

      // Réduire progressivement la vitesse
      this._basePlaybackSpeed = startSpeed * (1 - easeOut)

      if (progress < 1) {
        requestAnimationFrame(decelerate)
      } else {
        this._basePlaybackSpeed = 0
        this._isPoweredOn = false
      }
    }

    requestAnimationFrame(decelerate)
  }

  public setDuration(duration: number) {
    this._previousDuration = this._duration
    this._duration = duration
    this._maxAngle = duration * RPS * TAU
  }

  onDragStart(e: PointerEvent | TouchEvent) {
    // Vérifier si l'événement provient d'un élément avec la classe 'power-button' ou 'power-logo'
    const target = e.target as HTMLElement
    if (target.closest('.power-button, .power-logo')) {
      // Ne rien faire si l'événement provient du bouton power
      e.preventDefault()
      e.stopPropagation()
      return
    }

    // Empêcher le comportement par défaut pour éviter le défilement
    e.preventDefault()

    // Appeler le callback onDragStart
    this.callbacks.onDragStart()

    // Obtenir les coordonnées du toucher ou de la souris
    const getCoords = (event: PointerEvent | TouchEvent): { x: number; y: number } => {
      // Gestion des événements tactiles
      const touchEvent = event as TouchEvent
      if (touchEvent.touches?.[0]) {
        return {
          x: touchEvent.touches[0].clientX,
          y: touchEvent.touches[0].clientY
        }
      }

      // Gestion des événements de souris
      const mouseEvent = event as PointerEvent
      return {
        x: mouseEvent.clientX ?? this._center.x,
        y: mouseEvent.clientY ?? this._center.y
      }
    }

    const startCoords = getCoords(e)

    const onMove = (moveEvent: Event) => {
      if (!(moveEvent instanceof PointerEvent) && !(moveEvent instanceof TouchEvent)) return

      const coords = getCoords(moveEvent)

      this.onDragProgress({
        clientX: coords.x,
        clientY: coords.y,
        preventDefault: () => moveEvent.preventDefault(),
        stopPropagation: () => moveEvent.stopPropagation()
      } as MouseEvent)
    }

    const onEnd = () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('pointerup', onEnd)
      document.removeEventListener('touchend', onEnd)
      this.onDragEnd()
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('pointerup', onEnd)
    document.addEventListener('touchend', onEnd)

    this._center = getElementCenter(this.el)
    this._draggingFrom = startCoords
    this.isDragging = true
  }

  onDragProgress(e: {
    clientX: number
    clientY: number
    preventDefault: () => void
    stopPropagation: () => void
  }) {
    const currentTime = performance.now()
    const deltaTime = currentTime - this._lastDragTime

    const pointerPosition: Vector = {
      x: e.clientX,
      y: e.clientY
    }

    const anglePointerToCenter = angleBetween(this._center, pointerPosition)
    const angle_DraggingFromToCenter = angleBetween(this._center, this._draggingFrom)
    let angleDragged = angleDifference(angle_DraggingFromToCenter, anglePointerToCenter)

    // Calcul de la vitesse de déplacement angulaire (radians par milliseconde)
    // Le signe est inversé pour que le glissement vers la droite fasse tourner vers la droite
    if (deltaTime > 0) {
      this._lastDragVelocity = -angleDragged / deltaTime
    }

    this._lastDragTime = currentTime

    // Appliquer la rotation au disque
    // Le signe est inversé pour que le glissement vers la droite fasse tourner vers la droite
    this.setAngle(this._currentAngle - angleDragged)
    this._draggingFrom = { ...pointerPosition }
  }

  onDragEnd() {
    document.body.removeEventListener('pointermove', this.onDragProgress)
    document.body.removeEventListener('pointerup', this.onDragEnd)

    // Activer l'inertie avec la vitesse de drag actuelle
    this._isInertiaActive = true

    // Ajuster la direction de l'inertie en fonction du mode reverse
    const direction = this.isReversed ? -1 : 1
    this._inertiaVelocity = this._lastDragVelocity * this._inertiaAmplification * direction

    this.isDragging = false

    // Toujours conserver la vitesse de base actuelle (1 si allumé, 0 si éteint)
    this._basePlaybackSpeed = this._isPoweredOn ? (this.isReversed ? -1 : 1) : 0

    // Si le lecteur est éteint, s'assurer que la vitesse de base est bien à 0
    if (!this._isPoweredOn) {
      this._basePlaybackSpeed = 0
    }

    this.callbacks.onDragEnded(this.secondsPlayed)
  }

  autoRotate(currentTimestamp: number) {
    const timestampElapsed = currentTimestamp - this.previousTimestamp
    const direction = this.isReversed ? -1 : 1

    // Vérifier si on est au début du morceau en mode reverse
    if (this.isReversed && this.secondsPlayed <= 0) {
      this._currentAngle = 0
      this._inertiaVelocity = 0
      this._isInertiaActive = false
      this._playbackSpeed = 0
      this._basePlaybackSpeed = 0 // Arrêter complètement la lecture
      this.el.style.transform = 'rotate(0rad)'
      this.callbacks.onStop()

      // Éteindre le lecteur pour éviter toute reprise automatique
      this._isPoweredOn = false
      this.stop()
      return
    }

    if (this._isInertiaActive) {
      // Appliquer l'inertie en tenant compte de la direction
      const inertiaRotation = this._inertiaVelocity * timestampElapsed * direction
      this.setAngle(this._currentAngle + inertiaRotation, true)

      // Si le lecteur est allumé, faire une transition fluide vers la vitesse de lecture
      if (this._isPoweredOn) {
        const targetVelocity =
          RADIANS_PER_MILLISECOND * Math.abs(this._basePlaybackSpeed) * direction

        // Si on est proche de la vitesse de lecture normale, on désactive l'inertie
        if (Math.abs(this._inertiaVelocity - targetVelocity) < 0.0001) {
          this._isInertiaActive = false
          this._inertiaVelocity = targetVelocity
        } else {
          // Réduire progressivement la vitesse d'inertie vers la vitesse de lecture
          this._inertiaVelocity += (targetVelocity - this._inertiaVelocity) * 0.1
        }
      } else {
        // Si le lecteur est éteint, appliquer un frottement normal
        this._inertiaVelocity *= this._inertiaFriction

        // Si la vitesse est très faible, on arrête l'inertie
        if (Math.abs(this._inertiaVelocity) < 0.0001) {
          this._isInertiaActive = false
          this._inertiaVelocity = 0
          this._playbackSpeed = 0
        }
      }
    } else {
      // Rotation normale à la vitesse de lecture de base, dans la direction actuelle
      const baseRotation =
        RADIANS_PER_MILLISECOND * Math.abs(this._basePlaybackSpeed) * timestampElapsed * direction
      this.setAngle(this._currentAngle + baseRotation, true)
    }
  }

  setAngle(angle: number, checkBounds = false) {
    // Vérifier les limites si demandé
    if (checkBounds) {
      // Arrêt au début (angle < 0)
      if (angle < 0) {
        this._currentAngle = 0
        this._inertiaVelocity = 0
        this._isInertiaActive = false
        this._playbackSpeed = 0
        this._basePlaybackSpeed = 1
        this.el.style.transform = 'rotate(0rad)'
        // this.callbacks.onStop()
        // this._isPoweredOn = false
        // this.stop()
        return 0
      }
      // Arrêt à la fin (angle >= _maxAngle)
      else if (angle >= this._maxAngle) {
        this._currentAngle = this._maxAngle
        this._inertiaVelocity = 0
        this._isInertiaActive = false
        this._playbackSpeed = 0
        this._basePlaybackSpeed = 0
        this.el.style.transform = `rotate(${this._maxAngle}rad)`
        this.callbacks.onStop()
        this._isPoweredOn = false
        this.stop()
        return this._maxAngle
      }
    }

    // Si on dépasse les limites, on reste aux bornes
    if (angle < 0) {
      this._currentAngle = 0
    } else if (angle > this._maxAngle) {
      this._currentAngle = this._maxAngle
    } else {
      this._currentAngle = angle
    }

    // Appliquer la rotation à l'élément
    if (this.el) {
      this.el.style.transform = `rotate(${this._currentAngle}rad)`
    }

    return this._currentAngle
  }

  start() {
    this.previousTimestamp = performance.now()

    this.loop()
  }

  stop() {
    this._isInertiaActive = false
    this._inertiaVelocity = 0
    cancelAnimationFrame(this.rafId!)
    this.rafId = null
  }

  /**
   * Vérifie si le disque est à l'arrêt
   */
  isStopped(): boolean {
    return this.rafId === null && !this._isInertiaActive
  }

  /**
   * Inverse la direction de rotation du disque
   * @returns true si l'inversion a réussi, false sinon
   */
  reverse(): boolean {
    if (!this.el) return false

    // Inverser la direction
    this.isReversed = !this.isReversed

    // Inverser la vitesse de base si nécessaire
    if (this._isPoweredOn) {
      this._basePlaybackSpeed = this.isReversed ? -1 : 1
    }

    // Mettre à jour la direction de l'animation
    this.el.style.animationDirection = this.isReversed ? 'reverse' : 'normal'

    // Inverser la vitesse d'inertie si elle est active
    if (this._isInertiaActive) {
      this._inertiaVelocity = -this._inertiaVelocity
    }

    return true
  }

  loop() {
    const currentTimestamp = performance.now()
    const timestampDifferenceMS = currentTimestamp - this.previousTimestamp

    // Ne mettre à jour la rotation que si le lecteur est allumé et pas en train de glisser
    if (this._isPoweredOn && !this.isDragging) {
      this.autoRotate(currentTimestamp)
    }

    // Calculer la vitesse de lecture uniquement pendant le glissement ou l'inertie
    if (this.isDragging || this._isInertiaActive) {
      const rotated = this._currentAngle - this._previousAngle
      const rotationNormal = RADIANS_PER_MILLISECOND * timestampDifferenceMS
      this.playbackSpeed = rotated / rotationNormal || 0
    } else if (this._isPoweredOn) {
      // En mode lecture normale, utiliser la vitesse de base
      this._playbackSpeed = this._basePlaybackSpeed
    } else {
      // Si le lecteur est éteint, vitesse à 0
      this._playbackSpeed = 0
    }

    // Mettre à jour la rotation visuelle
    this.el.style.transform = `rotate(${this._currentAngle}rad)`

    // Appeler le callback onLoop avec les informations de lecture
    const secondsPlayed = this.secondsPlayed
    const progress = this._duration > 0 ? secondsPlayed / this._duration : 0

    // Ne pas appeler onLoop si rien n'a changé
    if (this._previousAngle !== this._currentAngle || this._previousDuration !== this._duration) {
      this.callbacks.onLoop({
        playbackSpeed: this._playbackSpeed, // Utiliser _playbackSpeed directement
        isReversed: this.isReversed,
        secondsPlayed,
        progress
      })
    }

    this._previousAngle = this._currentAngle
    this.previousTimestamp = currentTimestamp

    // Continuer la boucle d'animation
    this.rafId = requestAnimationFrame(this.loop)
  }
}

export default Disc
