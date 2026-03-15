<script setup lang="ts">
  import { onMounted, onBeforeUnmount, ref } from 'vue'
  import {
    FilesetResolver,
    HandLandmarker,
    DrawingUtils,
  } from '@mediapipe/tasks-vision'

  // ---------------------------------------------------------------------------
  // Exponential Moving Average smoother
  // alpha: 0 = no update (frozen), 1 = no smoothing (raw).
  // 0.25–0.35 gives good cursor smoothness with minimal lag.
  // ---------------------------------------------------------------------------
  class EMA {
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

  const cursorX = new EMA(0.3)
  const cursorY = new EMA(0.3)
  const pinchX = new EMA(0.35)
  const pinchY = new EMA(0.35)
  const pinchDist = new EMA(0.4)

  const videoRef = ref<HTMLVideoElement | null>(null)
  const canvasRef = ref<HTMLCanvasElement | null>(null)
  const isCameraActive = ref(false)

  // [Code Quality] Camera Permission Error Handling
  const cameraError = ref<string | null>(null)

  let handLandmarker: HandLandmarker | null = null
  let animationFrameId: number | null = null
  let drawingUtils: DrawingUtils | null = null

  // Keep a reference to the active stream for visibility-change cleanup
  let activeStream: MediaStream | null = null

  const initHandLandmarker = async () => {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
    )

    // [Performance] GPU Delegate Fallback for HandLandmarker
    try {
      handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 1,
      })
    } catch {
      console.warn('MediaPipe: GPU delegate failed, falling back to CPU')
      handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
          delegate: 'CPU',
        },
        runningMode: 'VIDEO',
        numHands: 1,
      })
    }
  }

  const startCamera = async () => {
    if (!handLandmarker || !videoRef.value) {
      console.log('Wait! handLandmarker not loaded yet.')
      return
    }

    // Clear any previous error
    cameraError.value = null

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 640,
          height: 480,
        },
      })

      activeStream = stream

      if (videoRef.value) {
        videoRef.value.srcObject = stream
        videoRef.value.addEventListener('loadeddata', () => {
          // Size canvas to match video feed
          if (canvasRef.value) {
            canvasRef.value.width = 640
            canvasRef.value.height = 480
            const ctx = canvasRef.value.getContext('2d')
            if (ctx) drawingUtils = new DrawingUtils(ctx)
          }
          predictWebcam()
        })
        isCameraActive.value = true
      }
    } catch (error) {
      // [Code Quality] User-friendly error instead of silent console.error
      console.error('Error accessing webcam:', error)
      cameraError.value =
        'Camera access denied. Please allow camera access and try again.'
    }
  }

  const stopCamera = () => {
    isCameraActive.value = false
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
    if (activeStream) {
      activeStream.getTracks().forEach((t) => t.stop())
      activeStream = null
    }
    if (videoRef.value) {
      videoRef.value.srcObject = null
    }
  }

  // [Security] Camera Stream Cleanup on Tab Visibility Change
  const handleVisibilityChange = () => {
    if (document.hidden) {
      stopCamera()
    } else {
      // Resume camera when tab becomes visible again
      startCamera()
    }
  }

  const props = defineProps<{
    pinchThreshold?: number
  }>()

  // Define specific emit events with types if possible, but for Vue setup we use defineEmits
  const emit = defineEmits<{
    (
      e: 'gesture',
      payload: {
        type: 'pinchStart' | 'pinchMove' | 'pinchEnd' | 'cursorMove'
        x: number
        y: number
      },
    ): void
    (e: 'pinchDistance', distance: number): void
  }>()

  let isPinching = false
  let releaseFrameCount = 0

  const predictWebcam = () => {
    if (!handLandmarker || !videoRef.value || !isCameraActive.value) return

    // Verify video is ready
    if (videoRef.value.readyState < 2) return

    const startTimeMs = performance.now()
    const results = handLandmarker.detectForVideo(videoRef.value, startTimeMs)

    // Clear canvas every frame
    const canvas = canvasRef.value
    const ctx = canvas ? canvas.getContext('2d') : null
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (results.landmarks && results.landmarks.length > 0) {
      const landmarks = results.landmarks[0]

      // Draw hand skeleton
      if (drawingUtils) {
        drawingUtils.drawConnectors(
          landmarks,
          HandLandmarker.HAND_CONNECTIONS,
          {
            color: 'rgba(255, 255, 255, 0.6)',
            lineWidth: 2,
          },
        )
        drawingUtils.drawLandmarks(landmarks, {
          color: (data) =>
            data.index === 4 || data.index === 8
              ? '#ff4444'
              : 'rgba(255,255,255,0.9)',
          fillColor: (data) =>
            data.index === 4 || data.index === 8
              ? 'rgba(255,80,80,0.5)'
              : 'rgba(255,255,255,0.3)',
          lineWidth: 1,
          radius: (data) => (data.index === 4 || data.index === 8 ? 7 : 4),
        })
      }

      // Gesture Logic
      // Index tip: 8, Thumb tip: 4
      const indexTip = landmarks[8]
      const thumbTip = landmarks[4]

      const rawDistance = Math.hypot(
        indexTip.x - thumbTip.x,
        indexTip.y - thumbTip.y,
      )
      pinchDist.update(rawDistance) // keep EMA in sync; smoothed value unused (raw used for state machine)

      // Dynamic pinch threshold — from calibration or fallback default
      const pinchThreshold = props.pinchThreshold ?? 0.03
      // Hysteresis: require 10% more gap to release than to grab.
      // Just enough to prevent a single noisy frame from re-grabbing mid-throw.
      const releaseThreshold = pinchThreshold * 1.1

      // Emit raw distance for calibration sampling (accurate max/min),
      // smoothed distance is only used internally for the pinch state machine.
      emit('pinchDistance', rawDistance)

      const centerX = (indexTip.x + thumbTip.x) / 2
      const centerY = (indexTip.y + thumbTip.y) / 2

      // Map to visual coordinates (Mirrored) — smoothed
      const visualX = pinchX.update(1 - centerX)
      const visualY = pinchY.update(centerY)

      // Cursor: follow pinch center while grabbing (stable, avoids landmark
      // confusion between thumb/index tip in awkward orientations), otherwise
      // follow index tip for hover/UI interactions.
      const rawCursorX = isPinching ? 1 - centerX : 1 - indexTip.x
      const rawCursorY = isPinching ? centerY : indexTip.y
      const cursorVisualX = cursorX.update(rawCursorX)
      const cursorVisualY = cursorY.update(rawCursorY)

      // Always emit cursor position for UI interaction (Hover)
      emit('gesture', {
        type: 'cursorMove',
        x: cursorVisualX,
        y: cursorVisualY,
      })

      // ── Pinch state machine — runs on RAW distance (not smoothed) ──────────
      // Using rawDistance here so release is detected the moment fingers open,
      // without waiting for the EMA to catch up.
      if (rawDistance < pinchThreshold) {
        // Pinching — cancel any pending release
        releaseFrameCount = 0

        if (!isPinching) {
          isPinching = true
          emit('gesture', { type: 'pinchStart', x: visualX, y: visualY })
        } else {
          emit('gesture', { type: 'pinchMove', x: visualX, y: visualY })
        }
      } else {
        // Past the grab threshold — check hysteresis band before releasing
        if (isPinching) {
          if (rawDistance > releaseThreshold) {
            // Clearly open — release immediately (1 frame confirmation)
            releaseFrameCount++
            if (releaseFrameCount >= 1) {
              isPinching = false
              releaseFrameCount = 0
              emit('gesture', { type: 'pinchEnd', x: visualX, y: visualY })
            } else {
              emit('gesture', { type: 'pinchMove', x: visualX, y: visualY })
            }
          } else {
            // In the hysteresis dead band — stay pinched, reset counter
            releaseFrameCount = 0
            emit('gesture', { type: 'pinchMove', x: visualX, y: visualY })
          }
        }
      }
    } else {
      // Hand lost — reset smoothers so stale values don't bleed into next detection
      cursorX.reset()
      cursorY.reset()
      pinchX.reset()
      pinchY.reset()
      pinchDist.reset()

      if (isPinching) {
        isPinching = false
        releaseFrameCount = 0
        emit('gesture', { type: 'pinchEnd', x: 0, y: 0 })
      }

      // Canvas already cleared at top of frame
    }

    if (isCameraActive.value) {
      animationFrameId = requestAnimationFrame(predictWebcam)
    }
  }

  // function drawLandmarks removed

  onMounted(async () => {
    await initHandLandmarker()
    startCamera()

    // [Security] Listen for tab visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange)
  })

  onBeforeUnmount(() => {
    stopCamera()

    // [Security] Remove visibility change listener
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  })
</script>

<template>
  <div class="camera-container">
    <video
      ref="videoRef"
      class="input_video"
      autoplay
      playsinline
      muted
    ></video>
    <!-- Canvas for landmarks removed/hidden? No, keep it for potential future use or just leave logic empty -->
    <canvas ref="canvasRef" class="output_canvas"></canvas>

    <!-- [Code Quality] Camera Permission Error Overlay -->
    <div v-if="cameraError" class="camera-error-overlay">
      <div class="camera-error-content">
        <div class="camera-error-icon">📷</div>
        <p class="camera-error-message">{{ cameraError }}</p>
        <button
          class="camera-retry-btn"
          @click="
            () => {
              cameraError = null
              startCamera()
            }
          "
        >
          Allow Camera &amp; Retry
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .camera-container {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .input_video,
  .output_canvas {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) scaleX(-1); /* Mirror effect */
    min-width: 100%;
    min-height: 100%;
    width: auto;
    height: auto;
    object-fit: cover; /* Fill the screen */
  }

  .output_canvas {
    z-index: 1; /* Overlay on top of video */
    pointer-events: none; /* Ensure it doesn't block interactions */
  }

  /* [Code Quality] Camera error overlay styles */
  .camera-error-overlay {
    position: absolute;
    inset: 0;
    z-index: 10;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .camera-error-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 40px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 16px;
    backdrop-filter: blur(8px);
    max-width: 400px;
    text-align: center;
  }

  .camera-error-icon {
    font-size: 3rem;
  }

  .camera-error-message {
    color: white;
    font-size: 1rem;
    line-height: 1.5;
    margin: 0;
  }

  .camera-retry-btn {
    background: rgba(255, 255, 255, 0.15);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
    padding: 12px 28px;
    border-radius: 10px;
    font-size: 1rem;
    font-weight: bold;
    cursor: pointer;
    transition: background 0.2s;
  }

  .camera-retry-btn:hover {
    background: rgba(255, 255, 255, 0.25);
  }
</style>
