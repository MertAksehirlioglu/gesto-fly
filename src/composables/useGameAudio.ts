import { ref } from 'vue'

/**
 * Web Audio API sound effects for Gesto Fly.
 *
 * AudioContext is created lazily on the first play call so we respect the
 * browser autoplay policy (must happen inside a user-gesture path or after one).
 *
 * The `muted` ref and the AudioContext are module-level singletons so every
 * component that calls useGameAudio() shares the same state.
 */

const MUTE_STORAGE_KEY = 'gesto-fly-muted'

const muted = ref(localStorage.getItem(MUTE_STORAGE_KEY) === 'true')
let audioCtx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext()
  }
  // Resume if suspended (browser may suspend until user interacts)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

/**
 * Short whoosh / swish sound (~0.3 s).
 * Sawtooth oscillator with a downward frequency sweep.
 */
function playSwish() {
  if (muted.value) return
  const ctx = getCtx()
  const t = ctx.currentTime

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(900, t)
  osc.frequency.exponentialRampToValueAtTime(180, t + 0.3)

  gain.gain.setValueAtTime(0.25, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3)

  osc.start(t)
  osc.stop(t + 0.3)
}

/**
 * Short metallic ping / clank (~0.2 s).
 * Sine + triangle oscillators for a rim-like impact.
 */
function playRimClank() {
  if (muted.value) return
  const ctx = getCtx()
  const t = ctx.currentTime

  const gain = ctx.createGain()
  gain.connect(ctx.destination)
  gain.gain.setValueAtTime(0.35, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25)

  const osc1 = ctx.createOscillator()
  osc1.type = 'sine'
  osc1.frequency.setValueAtTime(520, t)
  osc1.frequency.exponentialRampToValueAtTime(260, t + 0.25)
  osc1.connect(gain)
  osc1.start(t)
  osc1.stop(t + 0.25)

  const osc2 = ctx.createOscillator()
  osc2.type = 'triangle'
  osc2.frequency.setValueAtTime(1040, t)
  osc2.frequency.exponentialRampToValueAtTime(520, t + 0.25)
  osc2.connect(gain)
  osc2.start(t)
  osc2.stop(t + 0.25)
}

/**
 * Brief rising crowd cheer (~0.8 s).
 * Band-pass-filtered white noise with a rising envelope.
 */
function playCrowdCheer() {
  if (muted.value) return
  const ctx = getCtx()
  const t = ctx.currentTime
  const duration = 0.8

  // Generate white-noise buffer
  const bufferSize = Math.ceil(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1
  }

  const source = ctx.createBufferSource()
  source.buffer = buffer

  // Band-pass filter that sweeps upward for a "rising cheer" feel
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(600, t)
  filter.frequency.exponentialRampToValueAtTime(2400, t + duration)
  filter.Q.value = 1.2

  // Gain envelope: fade in fast, hold, fade out
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.001, t)
  gain.gain.exponentialRampToValueAtTime(0.4, t + 0.2)
  gain.gain.setValueAtTime(0.4, t + 0.5)
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration)

  source.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)

  source.start(t)
}

export function useGameAudio() {
  const toggleMute = () => {
    muted.value = !muted.value
    localStorage.setItem(MUTE_STORAGE_KEY, String(muted.value))
  }

  /** Close the shared AudioContext and release resources (call on app teardown). */
  const closeAudio = () => {
    if (audioCtx) {
      audioCtx.close().catch(() => undefined)
      audioCtx = null
    }
  }

  return {
    muted,
    toggleMute,
    playSwish,
    playRimClank,
    playCrowdCheer,
    closeAudio,
  }
}
