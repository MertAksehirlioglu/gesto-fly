import { ref } from 'vue'

interface DwellOptions {
  /** Duration in ms before the dwell completes. Default: 1500ms */
  duration?: number
  /** Called when the dwell timer completes */
  onComplete: () => void
}

/**
 * Encapsulates the hover-dwell (progress fill → click) interaction.
 *
 * Usage:
 *   const dwell = useGestureDwell({ onComplete: () => emit('exit') })
 *   // In checkButtons: dwell.startDwell() when cursor enters, dwell.cancelDwell() when it leaves
 *   // In template:  v-if="dwell.isActive.value"  :style="{ width: dwell.progress.value + '%' }"
 */
export function useGestureDwell(options: DwellOptions) {
  const duration = options.duration ?? 1500

  /** Progress 0–100 (percent) — use as CSS width for the progress bar */
  const progress = ref(0)
  /** Whether a dwell is currently in progress */
  const isActive = ref(false)

  let startTime = 0
  let animationFrame: number | null = null

  const loop = () => {
    if (!isActive.value) {
      animationFrame = null
      return
    }

    const elapsed = performance.now() - startTime
    progress.value = Math.min((elapsed / duration) * 100, 100)

    if (elapsed >= duration) {
      isActive.value = false
      progress.value = 0
      animationFrame = null
      options.onComplete()
    } else {
      animationFrame = requestAnimationFrame(loop)
    }
  }

  /**
   * Start the dwell timer. No-op if already active (preserves the original
   * start time so a jittery cursor doesn't reset the progress).
   */
  const startDwell = () => {
    if (isActive.value) return
    isActive.value = true
    startTime = performance.now()
    progress.value = 0
    if (animationFrame === null) {
      animationFrame = requestAnimationFrame(loop)
    }
  }

  /**
   * Cancel the dwell and reset progress.
   */
  const cancelDwell = () => {
    if (!isActive.value && animationFrame === null) return
    isActive.value = false
    progress.value = 0
    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame)
      animationFrame = null
    }
  }

  return { progress, isActive, startDwell, cancelDwell }
}
