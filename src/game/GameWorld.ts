import Matter from 'matter-js'
import { Basketball } from './Basketball'
import { Hoop } from './Hoop'

export class GameWorld {
  private element: HTMLElement
  private engine: Matter.Engine
  private render: Matter.Render
  private runner: Matter.Runner
  private width: number
  private height: number
  public activeBall: Basketball | null = null
  public activeHoop: Hoop | null = null

  constructor(element: HTMLElement) {
    this.element = element
    this.width = window.innerWidth
    this.height = window.innerHeight

    this.engine = Matter.Engine.create()

    this.render = Matter.Render.create({
      // element: this.element, // Don't use element if we want to use specific canvas
      canvas: this.element as HTMLCanvasElement, // Use the passed canvas element directly
      engine: this.engine,
      options: {
        width: this.width,
        height: this.height,
        wireframes: false, // Set true to debug physics bodies
        background: 'transparent',
      },
    })

    this.runner = Matter.Runner.create()

    this.init()
  }

  private init() {
    // Add boundaries (Ground, Walls)
    // Raised ground by 150px to allow easier grabbing
    const floorY = this.height - 150
    const floorHeight = 100
    const groundBody = Matter.Bodies.rectangle(
      this.width / 2,
      floorY + floorHeight / 2,
      this.width,
      floorHeight,
      { isStatic: true, label: 'ground' },
    )

    const rightWall = Matter.Bodies.rectangle(
      this.width,
      this.height / 2,
      60,
      this.height,
      { isStatic: true },
    )
    this.addBody([groundBody, rightWall])
  }

  spawnBall() {
    // Spawn ball on the left side (Player side)
    // Spawn significantly higher than the new floor (height - 150)
    // e.g. height - 400
    this.activeBall = new Basketball(200, this.height - 400)
    this.addBody(this.activeBall.getBody())
  }

  spawnHoop() {
    // Spawn hoop on the right side
    // Shifted left a bit as requested (was width - 200, now width - 300)
    const hoop = new Hoop(this.width - 300, this.height - 400)
    this.activeHoop = hoop
    Matter.Composite.add(this.engine.world, hoop.getComposite())
  }

  // Constraint for grabbing (Mouse Joint simulation)
  private grabConstraint: Matter.Constraint | null = null

  // Velocity Tracking
  private velocityBuffer: { x: number; y: number; time: number }[] = []
  private lastHandPos: { x: number; y: number; time: number } | null = null

  startGrab(x: number, y: number) {
    if (!this.activeBall) return

    const body = this.activeBall.getBody()

    // Proximity Check: Only grab if cursor is close to ball
    const distance = Matter.Vector.magnitude(
      Matter.Vector.sub(body.position, { x, y }),
    )
    if (distance > 80) return // Ignore grab if too far

    // Reset tracking
    this.velocityBuffer = []
    this.lastHandPos = { x, y, time: performance.now() }

    // Create a constraint to pull the ball to the hand
    this.grabConstraint = Matter.Constraint.create({
      pointA: { x, y }, // Hand position
      bodyB: body, // Ball
      pointB: { x: 0, y: 0 }, // Center of ball
      stiffness: 0.2, // Springiness (0.1 - 0.5 is good for "soft" grab)
      damping: 0.05,
      length: 0,
      render: { visible: true, strokeStyle: '#FFFFFF' },
    })

    Matter.Composite.add(this.engine.world, this.grabConstraint)
  }

  moveGrab(x: number, y: number) {
    if (this.grabConstraint) {
      this.grabConstraint.pointA = { x, y }

      const now = performance.now()
      if (this.lastHandPos) {
        const dt = now - this.lastHandPos.time
        if (dt > 0) {
          const vx = ((x - this.lastHandPos.x) / dt) * 16.67 // Scale to per-frame (Assuming 60fps)
          const vy = ((y - this.lastHandPos.y) / dt) * 16.67

          this.velocityBuffer.push({ x: vx, y: vy, time: now })

          // Keep buffer small (last ~10 frames / 160ms)
          if (this.velocityBuffer.length > 10) {
            this.velocityBuffer.shift()
          }
        }
      }
      this.lastHandPos = { x, y, time: now }
    }
  }

  endGrab() {
    if (this.grabConstraint) {
      Matter.Composite.remove(this.engine.world, this.grabConstraint)
      this.grabConstraint = null
    }

    if (this.activeBall) {
      const body = this.activeBall.getBody()

      // Calculate Throw Velocity from Buffer
      // We look for the "Peak" velocity in the last few frames to catch the "flick"
      // even if the user stopped their hand slightly before releasing (debounce delay).

      let maxSpeed = 0
      let throwVel = { x: 0, y: 0 }

      // Iterate backwards to find recent peak
      for (let i = this.velocityBuffer.length - 1; i >= 0; i--) {
        const entry = this.velocityBuffer[i]
        const speed = Math.hypot(entry.x, entry.y)
        if (speed > maxSpeed) {
          maxSpeed = speed
          throwVel = entry
        }
      }

      // Prune old data: If the peak was too long ago (> 200ms), ignore it.
      // But since buffer is only 10 frames, it's all recent.

      // Apply Force Multiplier
      // Adjusted from 2.0 to 0.3 because raw pixel velocity (e.g. 50px/frame) is already very high for Matter.js
      const throwMultiplier = 0.3

      if (maxSpeed > 2) {
        // Min threshold to consider it a throw
        Matter.Body.setVelocity(body, {
          x: throwVel.x * throwMultiplier,
          y: throwVel.y * throwMultiplier,
        })
        // Add a bit of spin for fun based on x velocity
        Matter.Body.setAngularVelocity(body, throwVel.x * 0.05)
      }

      // Clear buffer
      this.velocityBuffer = []
      this.lastHandPos = null
    }
  }



  start() {
    Matter.Render.run(this.render)
    Matter.Runner.run(this.runner, this.engine)

    // Game Loop Logic
    Matter.Events.on(this.engine, 'afterUpdate', () => {
      this.checkOutOfBounds()
    })

    // Collision Detection (Scoring)
    Matter.Events.on(this.engine, 'collisionStart', (event) => {
      const pairs = event.pairs
      for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i]
        const bodyA = pair.bodyA
        const bodyB = pair.bodyB

        // Check if Ball hit Sensor
        const isSensorA = bodyA.label === 'hoopSensor'
        const isSensorB = bodyB.label === 'hoopSensor'

        if (isSensorA || isSensorB) {
          const ballBody = isSensorA ? bodyB : bodyA

          // Strict check: Only count valid 'Basketball' labels
          if (ballBody.label === 'Basketball') {
            // Check direction: must be moving DOWN (positive Y velocity)
            if (ballBody.velocity.y > 0) {
              this.handleScore()
            }
          }
        }
      }
    })

    // Custom Rendering Loop
    Matter.Events.on(this.render, 'afterRender', () => {
      const ctx = this.render.context
      if (this.activeBall) {
        this.activeBall.render(ctx)
      }
      // TODO: Render Hoop Net here later
    })
  }

  checkOutOfBounds() {
    if (!this.activeBall || this.grabConstraint) return // Don't reset if holding

    const pos = this.activeBall.getBody().position
    const margin = 100

    // If ball falls way below floor or goes too far to sides
    if (
      pos.y > this.height + margin ||
      pos.x < -margin ||
      pos.x > this.width + margin
    ) {
      this.resetBall()
    }
  }

  stop() {
    if (this.render) {
      Matter.Render.stop(this.render)
      // Do NOT remove the canvas, let Vue handle it
      // this.render.canvas.remove()
    }
    if (this.runner) {
      Matter.Runner.stop(this.runner)
    }
  }

  addBody(
    body: Matter.Body | Matter.Body[] | Matter.Composite | Matter.Constraint,
  ) {
    Matter.Composite.add(this.engine.world, body)
  }

  resize(width: number, height: number) {
    this.width = width
    this.height = height
    if (this.render) {
      this.render.canvas.width = width
      this.render.canvas.height = height
    }
  }

  // Score Callback
  public onScore: (() => void) | null = null
  private isResetting = false

  handleScore() {
    if (this.isResetting) return // Debounce

    console.log('SCORE!')
    if (this.onScore) this.onScore()

    this.isResetting = true

    // Delay reset for celebration/visual confirmation
    setTimeout(() => {
      this.resetBall()
      this.isResetting = false
    }, 1000)
  }

  resetBall() {
    if (this.activeBall) {
      // Reset to start position
      Matter.Body.setPosition(this.activeBall.getBody(), {
        x: 200,
        y: this.height - 400,
      })
      Matter.Body.setVelocity(this.activeBall.getBody(), { x: 0, y: 0 })
      Matter.Body.setAngularVelocity(this.activeBall.getBody(), 0)
    }
  }
}
