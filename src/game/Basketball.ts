import Matter from 'matter-js'
import { PHYSICS_CONFIG } from './physicsConfig'

/**
 * Pre-renders the static basketball base sprite (gradient + seam lines) to an
 * OffscreenCanvas once at construction time and caches it as an ImageBitmap.
 * Each frame we simply drawImage the cached bitmap and apply ctx.rotate() for
 * the current physics angle, saving the per-frame cost of gradient creation and
 * path drawing.
 */
function buildSpriteBitmap(radius: number): ImageBitmap | null {
  const size = radius * 2
  try {
    const oc = new OffscreenCanvas(size, size)
    const ctx = oc.getContext('2d')
    if (!ctx) return null

    // Translate origin to centre of the canvas
    ctx.translate(radius, radius)

    // 1. Base Orange Circle with 3D Gradient
    const gradient = ctx.createRadialGradient(
      -radius * 0.2,
      -radius * 0.2,
      radius * 0.2,
      0,
      0,
      radius,
    )
    gradient.addColorStop(0, '#ff9100') // Light orange highlight
    gradient.addColorStop(1, '#d84e09') // Dark orange shadow

    ctx.beginPath()
    ctx.arc(0, 0, radius, 0, 2 * Math.PI)
    ctx.fillStyle = gradient
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = '#222'
    ctx.stroke()

    // 2. Black Lines (Basketball Pattern)
    ctx.lineWidth = 3
    ctx.strokeStyle = '#222'
    ctx.lineCap = 'round'

    // Horizontal line
    ctx.beginPath()
    ctx.moveTo(-radius, 0)
    ctx.lineTo(radius, 0)
    ctx.stroke()

    // Vertical curve (Ellipse approximation)
    ctx.beginPath()
    ctx.ellipse(0, 0, radius * 0.6, radius, 0, 0, Math.PI * 2)
    ctx.stroke()

    return oc.transferToImageBitmap()
  } catch {
    // OffscreenCanvas not available (e.g. test environments) — fall back gracefully
    return null
  }
}

export class Basketball {
  private body: Matter.Body
  private readonly radius: number
  private readonly spriteBitmap: ImageBitmap | null

  constructor(x: number, y: number, radius: number = PHYSICS_CONFIG.ball.radius) {
    this.radius = radius
    this.body = Matter.Bodies.circle(x, y, radius, {
      restitution: PHYSICS_CONFIG.ball.restitution,
      friction: PHYSICS_CONFIG.ball.friction,
      frictionAir: PHYSICS_CONFIG.ball.frictionAir,
      density: PHYSICS_CONFIG.ball.density,
      render: {
        visible: false, // Hide default rendering to use custom draw
      },
      label: 'Basketball',
    })
    // Build the sprite once; null if OffscreenCanvas is unavailable
    this.spriteBitmap = buildSpriteBitmap(radius)
  }

  getBody(): Matter.Body {
    return this.body
  }

  render(ctx: CanvasRenderingContext2D) {
    const { position, angle } = this.body

    ctx.save()
    ctx.translate(position.x, position.y)
    ctx.rotate(angle)

    if (this.spriteBitmap) {
      // Fast path: draw cached bitmap (no gradient/path work per frame)
      ctx.drawImage(this.spriteBitmap, -this.radius, -this.radius)
    } else {
      // Fallback: draw directly (same as before, for environments without OffscreenCanvas)
      const gradient = ctx.createRadialGradient(
        -this.radius * 0.2,
        -this.radius * 0.2,
        this.radius * 0.2,
        0,
        0,
        this.radius,
      )
      gradient.addColorStop(0, '#ff9100')
      gradient.addColorStop(1, '#d84e09')

      ctx.beginPath()
      ctx.arc(0, 0, this.radius, 0, 2 * Math.PI)
      ctx.fillStyle = gradient
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = '#222'
      ctx.stroke()

      ctx.lineWidth = 3
      ctx.strokeStyle = '#222'
      ctx.lineCap = 'round'

      ctx.beginPath()
      ctx.moveTo(-this.radius, 0)
      ctx.lineTo(this.radius, 0)
      ctx.stroke()

      ctx.beginPath()
      ctx.ellipse(0, 0, this.radius * 0.6, this.radius, 0, 0, Math.PI * 2)
      ctx.stroke()
    }

    ctx.restore()
  }
}
