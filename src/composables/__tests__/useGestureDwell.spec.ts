import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useGestureDwell } from '../useGestureDwell'

describe('useGestureDwell', () => {
  let mockNow = 0
  let rafCallback: FrameRequestCallback | null = null

  beforeEach(() => {
    mockNow = 0
    rafCallback = null

    vi.spyOn(performance, 'now').mockImplementation(() => mockNow)
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallback = cb
      return 1
    })
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const tick = (ms: number) => {
    mockNow = ms
    rafCallback!(ms)
  }

  it('starts inactive with zero progress', () => {
    const dwell = useGestureDwell({ onComplete: vi.fn(), duration: 1000 })
    expect(dwell.isActive.value).toBe(false)
    expect(dwell.progress.value).toBe(0)
  })

  it('startDwell() activates the dwell and schedules an animation frame', () => {
    const dwell = useGestureDwell({ onComplete: vi.fn(), duration: 1000 })
    dwell.startDwell()

    expect(dwell.isActive.value).toBe(true)
    expect(requestAnimationFrame).toHaveBeenCalledOnce()
  })

  it('cancelDwell() on an inactive dwell is a no-op', () => {
    const dwell = useGestureDwell({ onComplete: vi.fn(), duration: 1000 })
    expect(() => dwell.cancelDwell()).not.toThrow()
    expect(dwell.isActive.value).toBe(false)
    expect(dwell.progress.value).toBe(0)
  })

  it('cancelDwell() resets active dwell to zero progress', () => {
    const dwell = useGestureDwell({ onComplete: vi.fn(), duration: 1000 })
    dwell.startDwell()
    tick(500)
    expect(dwell.progress.value).toBe(50)

    dwell.cancelDwell()
    expect(dwell.isActive.value).toBe(false)
    expect(dwell.progress.value).toBe(0)
    expect(cancelAnimationFrame).toHaveBeenCalled()
  })

  it('progress advances proportionally with elapsed time', () => {
    const dwell = useGestureDwell({ onComplete: vi.fn(), duration: 1000 })
    dwell.startDwell()

    tick(250)
    expect(dwell.progress.value).toBe(25)

    tick(750)
    expect(dwell.progress.value).toBe(75)
  })

  it('calls onComplete when duration elapses and deactivates', () => {
    const onComplete = vi.fn()
    const dwell = useGestureDwell({ onComplete, duration: 1000 })
    dwell.startDwell()

    tick(1000)

    expect(onComplete).toHaveBeenCalledOnce()
    expect(dwell.isActive.value).toBe(false)
    expect(dwell.progress.value).toBe(0)
  })

  it('progress is capped at 100 when elapsed exceeds duration', () => {
    const onComplete = vi.fn()
    const dwell = useGestureDwell({ onComplete, duration: 1000 })
    dwell.startDwell()

    // Simulate a large jump (e.g. tab was backgrounded briefly)
    tick(2000)

    expect(onComplete).toHaveBeenCalledOnce()
    expect(dwell.progress.value).toBe(0) // reset after completion
  })

  it('startDwell while already active is a no-op (preserves start time)', () => {
    const dwell = useGestureDwell({ onComplete: vi.fn(), duration: 1000 })
    dwell.startDwell()

    tick(500)
    expect(dwell.progress.value).toBe(50)

    // Call again while active — should be ignored
    dwell.startDwell()

    // Progress should not reset — the start time is unchanged
    // Next tick should still advance from 500 relative to original startTime=0
    tick(600)
    expect(dwell.progress.value).toBe(60)
  })

  it('uses the custom duration option', () => {
    const onComplete = vi.fn()
    const dwell = useGestureDwell({ onComplete, duration: 2000 })
    dwell.startDwell()

    tick(1000)
    expect(dwell.progress.value).toBe(50) // halfway through 2000ms
    expect(onComplete).not.toHaveBeenCalled()

    tick(2000)
    expect(onComplete).toHaveBeenCalledOnce()
  })
})
