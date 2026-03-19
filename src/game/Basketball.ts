import Matter from 'matter-js'
import { PHYSICS_CONFIG } from './physicsConfig'

export class Basketball {
  private body: Matter.Body

  constructor(x: number, y: number, radius: number = PHYSICS_CONFIG.ball.radius) {
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
  }

  getBody(): Matter.Body {
    return this.body
  }

  render(ctx: CanvasRenderingContext2D) {
    const { position, angle } = this.body
    // Type guard for circleRadius (it exists on circle bodies)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const radius = (this.body as any).circleRadius || 20

    ctx.save()
    ctx.translate(position.x, position.y)
    ctx.rotate(angle)

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
    ctx.strokeStyle = '#222' // Darker for lines
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

    ctx.restore()
  }
}
