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
  private _inertiaAmplification: number = 12 // Facteur d'amplification de l'inertie (baissé pour éviter les flings trop violents)
  private _previousDuration: number = 0 // Pour suivre les changements de durée
  private _accelerationRafId: number | null = null // ID de l'animation d'accélération
  private _decelerationRafId: number | null = null // ID de l'animation de décélération

  // ID du pointeur actuellement utilisé pour le drag/scratch (pour supporter correctement
  // Pointer Events unifiés + multi-touch éventuel)
  private _activePointerId: number | null = null

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

    this.handlePointerDown = this.handlePointerDown.bind(this)
    this.handlePointerMove = this.handlePointerMove.bind(this)
    this.handlePointerUp = this.handlePointerUp.bind(this)
    this.loop = this.loop.bind(this)

    this.init()
  }

  init() {
    // Empêche le défilement et le geste de zoom pendant l'interaction avec le disque.
    this.el.style.touchAction = 'none'

    // On utilise uniquement Pointer Events (unifié souris/tactile/stylet).
    // Pattern robuste pour drag :
    // - pointerdown sur l'élément seulement (pour filtrer + démarrer le scratch)
    // - pointermove/up/cancel une seule fois sur document.
    // Les handlers filtrent via _activePointerId pour savoir si on est en train de dragger.
    this.el.addEventListener('pointerdown', this.handlePointerDown, { passive: false })

    document.addEventListener('pointermove', this.handlePointerMove, { passive: false })
    document.addEventListener('pointerup', this.handlePointerUp)
    document.addEventListener('pointercancel', this.handlePointerUp)
  }

  get playbackSpeed() {
    return this._playbackSpeed
  }

  set playbackSpeed(s) {
    this._draggingSpeeds.push(s)
    this._draggingSpeeds = limit(this._draggingSpeeds, 10)

    let avg = average(this._draggingSpeeds)

    // Limite raisonnable pour éviter de faire mal aux oreilles en scratch extrême.
    // Au-delà de ~3.5 ça devient très aigu / fatiguant, surtout en négatif (reverse).
    const MAX_SCRATCH_SPEED = 3.5
    avg = clamp(avg, -MAX_SCRATCH_SPEED, MAX_SCRATCH_SPEED)

    this._playbackSpeed = avg
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
    // Annuler la décélération en cours si elle existe
    if (this._decelerationRafId !== null) {
      cancelAnimationFrame(this._decelerationRafId)
      this._decelerationRafId = null
      // Si on annule une décélération, utiliser l'accélération pour une transition fluide
      this.powerOnWithAcceleration()
      return
    }
    this._isPoweredOn = true
    this._basePlaybackSpeed = this.isReversed ? -1 : 1
    this.start()
  }

  powerOnWithAcceleration(duration = 1500) {
    // Annuler la décélération en cours si elle existe
    if (this._decelerationRafId !== null) {
      cancelAnimationFrame(this._decelerationRafId)
      this._decelerationRafId = null
    }

    // Coupe toute inertie résiduelle (voir commentaire dans powerOn)
    this._isInertiaActive = false
    this._inertiaVelocity = 0

    this._isPoweredOn = true
    const targetSpeed = this.isReversed ? -1 : 1
    const startTime = performance.now()
    const startSpeed = this._basePlaybackSpeed // Utiliser la vitesse actuelle

    const accelerate = (timestamp: number) => {
      const elapsed = timestamp - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Courbe d'easing pour un effet naturel (easeOutCubic inversé)
      const easeIn = 1 - Math.pow(1 - progress, 3)

      // Augmenter progressivement la vitesse
      this._basePlaybackSpeed = startSpeed + (targetSpeed - startSpeed) * easeIn

      if (progress < 1) {
        this._accelerationRafId = requestAnimationFrame(accelerate)
      } else {
        this._basePlaybackSpeed = targetSpeed
        this._accelerationRafId = null
      }
    }

    this.start()
    this._accelerationRafId = requestAnimationFrame(accelerate)
  }

  powerOff() {
    // Annuler l'accélération en cours si elle existe
    if (this._accelerationRafId !== null) {
      cancelAnimationFrame(this._accelerationRafId)
      this._accelerationRafId = null
      // Si on annule une accélération, utiliser la décélération pour une transition fluide
      this.powerOffWithDeceleration()
      return
    }

    // Coupe toute inertie résiduelle
    this._isInertiaActive = false
    this._inertiaVelocity = 0

    this._isPoweredOn = false
    this._basePlaybackSpeed = 0
  }

  powerOffWithDeceleration(duration = 1500) {
    // Annuler l'accélération en cours si elle existe
    if (this._accelerationRafId !== null) {
      cancelAnimationFrame(this._accelerationRafId)
      this._accelerationRafId = null
    }

    // Coupe toute inertie résiduelle d'un scratch (sinon le slide reste "freiné" après pause)
    this._isInertiaActive = false
    this._inertiaVelocity = 0

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
        this._decelerationRafId = requestAnimationFrame(decelerate)
      } else {
        this._basePlaybackSpeed = 0
        this._isPoweredOn = false
        this._decelerationRafId = null
      }
    }

    this._decelerationRafId = requestAnimationFrame(decelerate)
  }

  public setDuration(duration: number) {
    this._previousDuration = this._duration
    this._duration = duration
    this._maxAngle = duration * RPS * TAU
  }

  /**
   * Gestion unifiée Pointer Events (souris + tactile).
   * Les listeners move/up sont toujours sur document (mis une seule fo is dans init).
   * On utilise _activePointerId pour savoir quand on est vraiment en train de dragger.
   */
  handlePointerDown(e: PointerEvent) {
    // Ignorer si l'utilisateur appuie sur le bouton power au centre
    const target = e.target as HTMLElement
    if (target.closest('.power-button, .power-logo')) {
      return
    }

    // Déjà en train de dragger avec un autre pointeur ?
    if (this._activePointerId !== null) {
      return
    }

    // Active pointer capture : les événements continuent d'arriver même si le contact
    // sort de la surface du disque (très utile en tactile).
    try {
      this.el.setPointerCapture(e.pointerId)
    } catch {}

    this._activePointerId = e.pointerId
    this._lastDragTime = performance.now()
    this._lastDragVelocity = 0

    e.preventDefault()

    this.callbacks.onDragStart()

    this._center = getElementCenter(this.el)
    this._draggingFrom = { x: e.clientX, y: e.clientY }
    this.isDragging = true
  }

  handlePointerMove(e: PointerEvent) {
    if (e.pointerId !== this._activePointerId) return

    const currentTime = performance.now()
    const deltaTime = currentTime - this._lastDragTime

    const pointerPosition: Vector = {
      x: e.clientX,
      y: e.clientY
    }

    const anglePointerToCenter = angleBetween(this._center, pointerPosition)
    const angle_DraggingFromToCenter = angleBetween(this._center, this._draggingFrom)
    let angleDragged = angleDifference(angle_DraggingFromToCenter, anglePointerToCenter)

    if (deltaTime > 0) {
      // Signe inversé : glisser vers la droite = faire tourner le disque "vers la droite"
      this._lastDragVelocity = -angleDragged / deltaTime
    }

    this._lastDragTime = currentTime

    this.setAngle(this._currentAngle - angleDragged)
    this._draggingFrom = { ...pointerPosition }

    // Aide à empêcher le scroll pendant le geste tactile
    if (e.cancelable) {
      try { e.preventDefault() } catch {}
    }
  }

  handlePointerUp(e: PointerEvent) {
    if (e.pointerId !== this._activePointerId) return

    try {
      this.el.releasePointerCapture(e.pointerId)
    } catch {}

    this._activePointerId = null
    this.isDragging = false

    // Inertie (comportement conservé)
    this._isInertiaActive = true
    const direction = this.isReversed ? -1 : 1
    this._inertiaVelocity = this._lastDragVelocity * this._inertiaAmplification * direction

    if (this._accelerationRafId === null && this._decelerationRafId === null) {
      this._basePlaybackSpeed = this._isPoweredOn ? (this.isReversed ? -1 : 1) : 0
      if (!this._isPoweredOn) {
        this._basePlaybackSpeed = 0
      }
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

    // Inverser la vitesse de base si nécessaire, mais seulement si aucune transition n'est en cours
    if (this._isPoweredOn && this._accelerationRafId === null && this._decelerationRafId === null) {
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
