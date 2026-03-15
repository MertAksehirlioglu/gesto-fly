import { ref, computed } from 'vue'

const STORAGE_KEY = 'gesto-fly-calibration'

interface CalibrationData {
  min: number
  max: number
  throwMultiplier: number
}

// Shared singleton state
const isCalibrated = ref(false)
const minPinch = ref(0)
const maxPinch = ref(0.12)
const throwMultiplier = ref(0.3)

// Derived threshold: 30% up from min toward max
const pinchThreshold = computed(() => {
  if (!isCalibrated.value) return 0.03
  const range = maxPinch.value - minPinch.value
  return minPinch.value + range * 0.3
})

const loadFromStorage = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const data: CalibrationData = JSON.parse(raw)
    if (typeof data.min === 'number' && typeof data.max === 'number') {
      minPinch.value = data.min
      maxPinch.value = data.max
      throwMultiplier.value = data.throwMultiplier ?? 0.3
      isCalibrated.value = true
    }
  } catch {
    // ignore
  }
}

const finalize = (min: number, max: number) => {
  minPinch.value = min
  maxPinch.value = max
  isCalibrated.value = true
  const data: CalibrationData = {
    min,
    max,
    throwMultiplier: throwMultiplier.value,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

const reset = () => {
  isCalibrated.value = false
  minPinch.value = 0
  maxPinch.value = 0.12
  throwMultiplier.value = 0.3
  localStorage.removeItem(STORAGE_KEY)
}

// Load on first import
loadFromStorage()

export function useCalibration() {
  return {
    isCalibrated,
    pinchThreshold,
    throwMultiplier,
    finalize,
    reset,
  }
}
