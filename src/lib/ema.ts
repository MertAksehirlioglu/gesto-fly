/**
 * Exponential Moving Average smoother.
 *
 * alpha: 0 = no update (frozen), 1 = no smoothing (raw).
 * 0.25–0.35 gives good cursor smoothness with minimal lag.
 */
export class EMA {
  private alpha: number
  private value: number | null = null

  constructor(alpha = 0.3) {
    this.alpha = alpha
  }

  update(raw: number): number {
    this.value =
      this.value === null
        ? raw
        : this.alpha * raw + (1 - this.alpha) * this.value
    return this.value
  }

  reset() {
    this.value = null
  }
}
