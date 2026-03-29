import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const STORAGE_KEY = 'gesto-fly-calibration'

describe('useCalibration', () => {
  // localStorage spy storage
  let store: Record<string, string> = {}

  beforeEach(() => {
    store = {}
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(
      (key: string) => store[key] ?? null,
    )
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(
      (key: string, value: string) => {
        store[key] = value
      },
    )
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(
      (key: string) => {
        delete store[key]
      },
    )
    // Fresh module on every test
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('defaults to uncalibrated with pinchThreshold 0.03', async () => {
    const { useCalibration } = await import('../useCalibration')
    const { isCalibrated, pinchThreshold } = useCalibration()

    expect(isCalibrated.value).toBe(false)
    expect(pinchThreshold.value).toBe(0.03)
  })

  it('finalize() updates reactive state and persists to localStorage', async () => {
    const { useCalibration } = await import('../useCalibration')
    const { finalize, isCalibrated, pinchThreshold } = useCalibration()

    finalize(0.02, 0.15)

    expect(isCalibrated.value).toBe(true)
    // pinchThreshold = min + (max - min) * 0.3 = 0.02 + 0.13 * 0.3 ≈ 0.059
    expect(pinchThreshold.value).toBeCloseTo(0.059, 5)

    const saved = JSON.parse(store[STORAGE_KEY])
    expect(saved.min).toBe(0.02)
    expect(saved.max).toBe(0.15)
    expect(saved.throwMultiplier).toBe(0.3)
  })

  it('reset() clears reactive state and removes localStorage entry', async () => {
    const { useCalibration } = await import('../useCalibration')
    const { finalize, reset, isCalibrated, pinchThreshold } = useCalibration()

    finalize(0.02, 0.15)
    expect(isCalibrated.value).toBe(true)

    reset()

    expect(isCalibrated.value).toBe(false)
    expect(pinchThreshold.value).toBe(0.03)
    expect(store[STORAGE_KEY]).toBeUndefined()
  })

  it('loadFromStorage() restores calibration on module import', async () => {
    // Pre-populate storage before importing the module
    store[STORAGE_KEY] = JSON.stringify({
      min: 0.05,
      max: 0.2,
      throwMultiplier: 0.4,
    })

    const { useCalibration } = await import('../useCalibration')
    const { isCalibrated, pinchThreshold, throwMultiplier } = useCalibration()

    expect(isCalibrated.value).toBe(true)
    expect(throwMultiplier.value).toBe(0.4)
    // pinchThreshold = 0.05 + (0.2 - 0.05) * 0.3 = 0.05 + 0.045 = 0.095
    expect(pinchThreshold.value).toBeCloseTo(0.095, 5)
  })

  it('loadFromStorage() ignores invalid JSON without throwing', async () => {
    store[STORAGE_KEY] = 'not-valid-json'

    const { useCalibration } = await import('../useCalibration')
    const { isCalibrated } = useCalibration()

    expect(isCalibrated.value).toBe(false)
  })

  it('loadFromStorage() ignores entries missing min/max fields', async () => {
    store[STORAGE_KEY] = JSON.stringify({ foo: 'bar' })

    const { useCalibration } = await import('../useCalibration')
    const { isCalibrated } = useCalibration()

    expect(isCalibrated.value).toBe(false)
  })
})
