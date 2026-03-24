import { describe, it, expect } from 'vitest'
import { EMA } from '../../lib/ema'

describe('EMA', () => {
  it('first update returns the raw value', () => {
    const ema = new EMA(0.3)
    expect(ema.update(10)).toBe(10)
  })

  it('subsequent updates blend toward the new value', () => {
    const ema = new EMA(0.5)
    ema.update(0) // initialise at 0
    // alpha=0.5: next = 0.5 * 100 + 0.5 * 0 = 50
    expect(ema.update(100)).toBe(50)
  })

  it('converges to the target after many updates', () => {
    const ema = new EMA(0.5)
    ema.update(0)
    let val = 0
    for (let i = 0; i < 30; i++) val = ema.update(100)
    expect(val).toBeGreaterThan(99.9)
  })

  it('alpha=1 gives no smoothing (raw pass-through)', () => {
    const ema = new EMA(1)
    ema.update(5)
    expect(ema.update(42)).toBe(42)
  })

  it('alpha=0 freezes the value after initialisation', () => {
    const ema = new EMA(0)
    ema.update(5) // initialise
    ema.update(100) // should not move
    expect(ema.update(999)).toBe(5)
  })

  it('reset() clears state so the next update is treated as the first', () => {
    const ema = new EMA(0.3)
    ema.update(50)
    ema.reset()
    expect(ema.update(7)).toBe(7)
  })

  it('handles negative values correctly', () => {
    const ema = new EMA(0.5)
    ema.update(-10) // initialise
    // next = 0.5 * (-100) + 0.5 * (-10) = -55
    expect(ema.update(-100)).toBe(-55)
  })
})
