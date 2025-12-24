import Matter from 'matter-js'

export class Hoop {
  private composite: Matter.Composite
  private netParts: Matter.Body[] = []
  private netLinks: Matter.Constraint[] = [] // Store horizontal links
  private rimLeft: Matter.Body
  private rimRight: Matter.Body
  public sensor!: Matter.Body // Public for collision access? Or via getter? Public easiest for game loop.

  constructor(x: number, y: number) {
    this.composite = Matter.Composite.create()

    // 1. Pole (Ground to Backboard)
    // Positioned slightly behind the backboard
    const poleX = x + 20
    const pole = Matter.Bodies.rectangle(poleX, y + 200, 15, 600, {
      isStatic: true,
      render: { fillStyle: '#7f8c8d' }, // Gray metal
      label: 'pole',
    })

    // 2. Backboard (Rectangle with border look)
    const backboard = Matter.Bodies.rectangle(x, y - 50, 10, 140, {
      isStatic: true,
      render: {
        fillStyle: 'rgba(255, 255, 255, 0.9)',
        strokeStyle: '#333',
        lineWidth: 3,
      },
      label: 'backboard',
    })

    // 3. Rim
    const rimY = y + 20
    const rimWidth = 80

    // Rim Bracket (Neck) connecting backboard to rim
    // Small rectangle between backboard and rim circles
    const rimNeck = Matter.Bodies.rectangle(x - 5, rimY + 2, 10, 8, {
      isStatic: true,
      render: { fillStyle: '#e74c3c' },
    })

    // Sensor for Scoring (Transparent, Sensor mode)
    // Placed slightly below the rim level to ensure ball has passed through
    const sensorY = rimY + 30
    // Center x between rimLeft and rimRight?
    // rimLeft is at x - rimWidth (approx x - 80)
    // rimRight is at x - 5
    // so center is approx x - 42.5
    const sensorX = x - rimWidth / 2 - 2.5

    this.sensor = Matter.Bodies.rectangle(sensorX, sensorY, 40, 5, {
      isStatic: true,
      isSensor: true, // Does not physically collide
      label: 'hoopSensor',
      render: {
        visible: true, // Debug: Set to false later. Keeping true for verifying position.
        fillStyle: 'rgba(0, 255, 0, 0.5)', // Green debug line
      },
    })

    this.rimLeft = Matter.Bodies.circle(x - rimWidth, rimY, 4, {
      isStatic: true,
      label: 'rim',
      render: { fillStyle: '#e74c3c' },
    })

    this.rimRight = Matter.Bodies.circle(x - 5, rimY, 4, {
      isStatic: true,
      label: 'rim',
      render: { fillStyle: '#e74c3c' },
    })

    // 4. Net (Cloth Physics / Chain)
    const netGroup = Matter.Body.nextGroup(true)
    const netSegments = 5
    const netLength = 15

    // Create 3 vertical chains hanging from rim range
    const startX = x - rimWidth
    const endX = x - 5
    const stepX = (endX - startX) / 3 // 4 strands

    // Store all vertical strands to connect them horizontally later
    const allStrands: Matter.Body[][] = []

    for (let i = 0; i <= 3; i++) {
      const chainX = startX + i * stepX
      const chainStartY = rimY // Start exactly at rimY (anchor point) to avoid snap

      // Manually create bodies perfectly aligned to avoid initial spring jitter
      const strandBodies: Matter.Body[] = []
      for (let j = 0; j < netSegments; j++) {
        const body = Matter.Bodies.rectangle(
          chainX,
          chainStartY + j * netLength + netLength / 2,
          3,
          netLength,
          {
            collisionFilter: { group: netGroup },
            frictionAir: 0.1, // Increased friction to reduce swinging
            render: { fillStyle: 'white' },
          },
        )
        strandBodies.push(body)
      }

      const strand = Matter.Composite.create()
      Matter.Composite.add(strand, strandBodies)

      // Link them tightly
      // Connect BOTTOM of Previous (0.5) to TOP of Next (-0.5)
      Matter.Composites.chain(strand, 0, 0.5, 0, -0.5, {
        stiffness: 0.8,
        length: 0,
        render: { visible: false },
      })

      // Attach top of strand to static rim-line
      // Important: Anchor point must match top body's top point to avoid "snap"
      const anchorPt = { x: chainX, y: rimY }
      const anchor = Matter.Constraint.create({
        pointA: anchorPt,
        bodyB: strandBodies[0],
        pointB: { x: 0, y: -netLength / 2 },
        stiffness: 0.9,
        length: 0, // Keep tight
      })

      Matter.Composite.add(this.composite, [strand, anchor])

      // Store bodies to update color later
      this.netParts.push(...strand.bodies)
      allStrands.push(strandBodies)
    }

    // 5. Horizontal Connections (The Mesh)
    // Connect corresponding segments of adjacent strands
    for (let i = 0; i < allStrands.length - 1; i++) {
      const currentStrand = allStrands[i]
      const nextStrand = allStrands[i + 1]

      for (let j = 0; j < currentStrand.length; j++) {
        const bodyA = currentStrand[j]
        const bodyB = nextStrand[j]

        // Connect centers? Or maybe top-to-top? Centers is easiest/safest
        const link = Matter.Constraint.create({
          bodyA: bodyA,
          bodyB: bodyB,
          stiffness: 0.5, // Less stiff than vertical to allow expansion
          render: {
            visible: true,
            type: 'line',
            strokeStyle: '#FFFFFF', // Default white
            lineWidth: 3, // Match vertical thickness
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

  // ... (color logic)

  // define property at top of class
  // private sensor: Matter.Body

  setNetColor(color: string) {
    if (color.includes('gradient')) return // Simple colors only for now

    // Update Vertical Bodies
    this.netParts.forEach((body) => {
      body.render.fillStyle = color
    })

    // Update Horizontal Constraints
    this.netLinks.forEach((link) => {
      if (link.render) {
        link.render.strokeStyle = color
      }
    })
  }

  getComposite(): Matter.Composite {
    return this.composite
  }
}
