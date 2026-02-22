import Matter from 'matter-js'

export class Hoop {
  private composite: Matter.Composite
  private netParts: Matter.Body[] = []
  private netLinks: Matter.Constraint[] = []
  private rimLeft: Matter.Body
  private rimRight: Matter.Body
  public sensor!: Matter.Body

  // Net draw info
  private netStartX: number = 0
  private netEndX: number = 0
  private netTopY: number = 0
  private currentNetColor: string = 'white'

  constructor(x: number, y: number) {
    this.composite = Matter.Composite.create()

    // 1. Pole
    const poleX = x + 20
    const pole = Matter.Bodies.rectangle(poleX, y + 200, 15, 600, {
      isStatic: true,
      render: { fillStyle: '#7f8c8d' },
      label: 'pole',
    })

    // 2. Backboard — restitution for bank shots
    const backboard = Matter.Bodies.rectangle(x, y - 50, 10, 140, {
      isStatic: true,
      restitution: 0.65,
      friction: 0.1,
      render: {
        fillStyle: 'rgba(255, 255, 255, 0.0)',
        strokeStyle: '#333',
        lineWidth: 3,
      },
      label: 'backboard',
    })

    // 3. Rim
    const rimY = y + 20
    const rimWidth = 80

    // Rim neck bracket
    const rimNeck = Matter.Bodies.rectangle(x - 5, rimY + 2, 10, 8, {
      isStatic: true,
      render: { fillStyle: '#e74c3c' },
    })

    // Scoring sensor — invisible
    const sensorY = rimY + 30
    const sensorX = x - rimWidth / 2 - 2.5
    this.sensor = Matter.Bodies.rectangle(sensorX, sensorY, 40, 5, {
      isStatic: true,
      isSensor: true,
      label: 'hoopSensor',
      render: { visible: false },
    })

    // Rim bodies — flat rectangles so the ball can land/roll on them
    this.rimLeft = Matter.Bodies.rectangle(x - rimWidth, rimY, 12, 6, {
      isStatic: true,
      label: 'rim',
      restitution: 0.4,
      friction: 0.3,
      render: { fillStyle: '#e74c3c' },
    })
    this.rimRight = Matter.Bodies.rectangle(x - 5, rimY, 12, 6, {
      isStatic: true,
      label: 'rim',
      restitution: 0.4,
      friction: 0.3,
      render: { fillStyle: '#e74c3c' },
    })

    // 4. Net (physics only — rendered visually in GameWorld)
    const netGroup = Matter.Body.nextGroup(true)
    const netSegments = 5
    const netLength = 15

    const startX = x - rimWidth
    const endX = x - 5
    const stepX = (endX - startX) / 3

    // Store net bounds for canvas drawing
    this.netStartX = startX
    this.netEndX = endX
    this.netTopY = rimY

    const allStrands: Matter.Body[][] = []

    for (let i = 0; i <= 3; i++) {
      const chainX = startX + i * stepX
      const chainStartY = rimY

      const strandBodies: Matter.Body[] = []
      for (let j = 0; j < netSegments; j++) {
        const body = Matter.Bodies.rectangle(
          chainX,
          chainStartY + j * netLength + netLength / 2,
          3,
          netLength,
          {
            collisionFilter: { group: netGroup },
            frictionAir: 0.1,
            render: { fillStyle: 'rgba(255,255,255,0.85)' },
          },
        )
        strandBodies.push(body)
      }

      const strand = Matter.Composite.create()
      Matter.Composite.add(strand, strandBodies)

      Matter.Composites.chain(strand, 0, 0.5, 0, -0.5, {
        stiffness: 0.8,
        length: 0,
        render: { visible: false },
      })

      const anchorPt = { x: chainX, y: rimY }
      const anchor = Matter.Constraint.create({
        pointA: anchorPt,
        bodyB: strandBodies[0],
        pointB: { x: 0, y: -netLength / 2 },
        stiffness: 0.9,
        length: 0,
      })

      Matter.Composite.add(this.composite, [strand, anchor])
      this.netParts.push(...strand.bodies)
      allStrands.push(strandBodies)
    }

    // 5. Horizontal net links — invisible
    for (let i = 0; i < allStrands.length - 1; i++) {
      const currentStrand = allStrands[i]
      const nextStrand = allStrands[i + 1]

      for (let j = 0; j < currentStrand.length; j++) {
        const link = Matter.Constraint.create({
          bodyA: currentStrand[j],
          bodyB: nextStrand[j],
          stiffness: 0.5,
          render: {
            visible: true,
            type: 'line',
            strokeStyle: 'rgba(255,255,255,0.7)',
            lineWidth: 2,
          },
        })

        Matter.Composite.add(this.composite, link)
        this.netLinks.push(link)
      }
    }

    Matter.Composite.add(this.composite, [
      pole,
      backboard,
      rimNeck,
      this.rimLeft,
      this.rimRight,
      this.sensor,
    ])
  }

  setNetColor(color: string) {
    if (color.includes('gradient')) return

    this.currentNetColor = color

    this.netParts.forEach((body) => {
      body.render.fillStyle = color
    })

    this.netLinks.forEach((link) => {
      if (link.render) {
        link.render.strokeStyle = color
      }
    })
  }

  getNetInfo(): { startX: number; endX: number; topY: number; color: string } {
    return {
      startX: this.netStartX,
      endX: this.netEndX,
      topY: this.netTopY,
      color: this.currentNetColor,
    }
  }

  getComposite(): Matter.Composite {
    return this.composite
  }
}
