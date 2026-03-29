<script setup lang="ts">
  import { onMounted, onBeforeUnmount, ref } from 'vue'
  import { HandLandmarker, DrawingUtils } from '@mediapipe/tasks-vision'
  import { EMA } from '../lib/ema'
  import { verifyAssetIntegrity } from '../composables/verifyAssetIntegrity'
  import MediaPipeWorker from '../workers/mediapipeWorker.ts?worker'
  import type { SerializedLandmark } from '../workers/mediapipeWorker'

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

  // [Performance] Web Worker for off-main-thread inference
  let inferenceWorker: Worker | null = null
  let workerBusy = false
  let workerReady = false
  let latestLandmarks: SerializedLandmark[][] = []

  let animationFrameId: number | null = null
  let drawingUtils: DrawingUtils | null = null

  // Keep a reference to the active stream for visibility-change cleanup
  let activeStream: MediaStream | null = null

  // Pinned MediaPipe WASM package version (matches installed npm package).
  const MEDIAPIPE_WASM_URL =
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm'

  // Model asset URL and its SRI hash (sha384, base64-encoded).
  const MODEL_URL =
    'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
  const MODEL_SHA384 =
    'sha384-uWvruVKd887ov8k43S+DBHCsi7UXXS+CKvvdM1PX00rjPzx/B0QrAPfJ1U9yKcze'

  const initHandLandmarker = async (): Promise<void> => {
    // Verify model integrity on the main thread, then transfer buffer to worker
    const modelBuffer = await verifyAssetIntegrity(MODEL_URL, MODEL_SHA384)

    return new Promise((resolve, reject) => {
      inferenceWorker = new MediaPipeWorker()

      inferenceWorker.onmessage = (e: MessageEvent) => {
        const { type, ...data } = e.data as {
          type: string
          message?: string
          landmarks?: SerializedLandmark[][]
        }

        if (type === 'READY') {
          workerReady = true
          resolve()
        } else if (type === 'ERROR') {
          reject(new Error(data.message))
        } else if (type === 'RESULTS') {
          latestLandmarks = data.landmarks ?? []
          workerBusy = false
          processGestureResults()
        }
      }

      inferenceWorker.onerror = (err) => {
        reject(err)
      }

      // Transfer the ArrayBuffer to the worker (zero-copy)
      inferenceWorker.postMessage(
        { type: 'INIT', wasmUrl: MEDIAPIPE_WASM_URL, modelBuffer },
        [modelBuffer],
      )
    })
  }

  const startCamera = async () => {
    if (!workerReady || !videoRef.value) {
      console.log('Wait! inference worker not ready yet.')
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
    // Reset state so stale landmarks are not redrawn after resuming
    latestLandmarks = []
    workerBusy = false
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
    (e: 'pinchStateChange', isPinching: boolean): void
    (e: 'handDetected', detected: boolean): void
  }>()

  let isPinching = false
  let releaseFrameCount = 0

  // [Performance] Throttle HandLandmarker inference to 30 FPS
  const INFERENCE_INTERVAL_MS = 1000 / 30
  let lastInferenceTime = 0

  /**
   * Process the latest landmarks received from the inference worker.
   * This runs on the main thread but does NOT block the physics/render tick
   * because inference itself is happening in the worker.
   */
  const processGestureResults = () => {
    if (latestLandmarks.length > 0) {
      emit('handDetected', true)
      const landmarks = latestLandmarks[0]

      // Draw hand skeleton with confidence-based coloring.
      // Each joint is graded by its visibility score:
      //   ≥ 0.8 → green  (reliable)
      //   ≥ 0.5 → yellow (borderline)
      //   < 0.5 → red    (unreliable — player should reposition)
      if (drawingUtils) {
        const confidenceColor = (v: number | undefined): string => {
          const vis = v ?? 0
          if (vis >= 0.8) return 'rgba(0, 220, 80, 0.7)'
          if (vis >= 0.5) return 'rgba(255, 220, 0, 0.7)'
          return 'rgba(255, 60, 60, 0.7)'
        }
        const confidenceFill = (v: number | undefined): string => {
          const vis = v ?? 0
          if (vis >= 0.8) return 'rgba(0, 220, 80, 0.35)'
          if (vis >= 0.5) return 'rgba(255, 220, 0, 0.35)'
          return 'rgba(255, 60, 60, 0.35)'
        }

        const normalizedLandmarks = landmarks as unknown as import('@mediapipe/tasks-vision').NormalizedLandmark[]
        drawingUtils.drawConnectors(
          normalizedLandmarks,
          HandLandmarker.HAND_CONNECTIONS,
          {
            color: (data) => {
              const avg = ((data.from?.visibility ?? 0) + (data.to?.visibility ?? 0)) / 2
              return confidenceColor(avg)
            },
            lineWidth: 2,
          },
        )
        drawingUtils.drawLandmarks(normalizedLandmarks, {
          color: (data) => confidenceColor(data.from?.visibility),
          fillColor: (data) => confidenceFill(data.from?.visibility),
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
      pinchDist.update(rawDistance)

      const pinchThreshold = props.pinchThreshold ?? 0.03
      const releaseThreshold = pinchThreshold * 1.1

      emit('pinchDistance', rawDistance)

      const centerX = (indexTip.x + thumbTip.x) / 2
      const centerY = (indexTip.y + thumbTip.y) / 2

      const visualX = pinchX.update(1 - centerX)
      const visualY = pinchY.update(centerY)

      const rawCursorX = isPinching ? 1 - centerX : 1 - indexTip.x
      const rawCursorY = isPinching ? centerY : indexTip.y
      const cursorVisualX = cursorX.update(rawCursorX)
      const cursorVisualY = cursorY.update(rawCursorY)

      emit('gesture', {
        type: 'cursorMove',
        x: cursorVisualX,
        y: cursorVisualY,
      })

      // Pinch state machine — runs on RAW distance
      if (rawDistance < pinchThreshold) {
        releaseFrameCount = 0
        if (!isPinching) {
          isPinching = true
          emit('pinchStateChange', true)
          emit('gesture', { type: 'pinchStart', x: visualX, y: visualY })
        } else {
          emit('gesture', { type: 'pinchMove', x: visualX, y: visualY })
        }
      } else {
        if (isPinching) {
          if (rawDistance > releaseThreshold) {
            releaseFrameCount++
            if (releaseFrameCount >= 1) {
              isPinching = false
              releaseFrameCount = 0
              emit('pinchStateChange', false)
              emit('gesture', { type: 'pinchEnd', x: visualX, y: visualY })
            } else {
              emit('gesture', { type: 'pinchMove', x: visualX, y: visualY })
            }
          } else {
            releaseFrameCount = 0
            emit('gesture', { type: 'pinchMove', x: visualX, y: visualY })
          }
        }
      }
    } else {
      emit('handDetected', false)
      // Hand lost — reset smoothers
      cursorX.reset()
      cursorY.reset()
      pinchX.reset()
      pinchY.reset()
      pinchDist.reset()

      if (isPinching) {
        isPinching = false
        releaseFrameCount = 0
        emit('pinchStateChange', false)
        emit('gesture', { type: 'pinchEnd', x: 0, y: 0 })
      }
    }
  }

  const predictWebcam = () => {
    if (!inferenceWorker || !videoRef.value || !isCameraActive.value) return

    // Verify video is ready
    if (videoRef.value.readyState < 2) {
      animationFrameId = requestAnimationFrame(predictWebcam)
      return
    }

    const startTimeMs = performance.now()

    // Clear canvas every frame
    const canvas = canvasRef.value
    const ctx = canvas ? canvas.getContext('2d') : null
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Redraw the latest landmarks at RAF rate (smooth, no flicker)
      if (latestLandmarks.length > 0 && drawingUtils) {
        // Cast to NormalizedLandmark[]: visibility is optional in our serialized type but
        // always present for DrawingUtils (MediaPipe sets it to 0 when absent).
        const landmarks =
          latestLandmarks[0] as unknown as import('@mediapipe/tasks-vision').NormalizedLandmark[]
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
    }

    // Submit a new inference frame to the worker if not busy and throttle elapsed
    if (
      !workerBusy &&
      workerReady &&
      startTimeMs - lastInferenceTime >= INFERENCE_INTERVAL_MS
    ) {
      lastInferenceTime = startTimeMs
      workerBusy = true

      // createImageBitmap is fast (~1ms) — fire-and-forget, do not await in RAF
      createImageBitmap(videoRef.value).then(
        (bitmap) => {
          if (inferenceWorker && isCameraActive.value) {
            // Transfer bitmap (zero-copy) to worker for inference
            inferenceWorker.postMessage(
              { type: 'DETECT', bitmap, timestamp: startTimeMs },
              [bitmap],
            )
          } else {
            bitmap.close()
            workerBusy = false
          }
        },
        () => {
          workerBusy = false
        },
      )
    }

    if (isCameraActive.value) {
      animationFrameId = requestAnimationFrame(predictWebcam)
    }
  }

  onMounted(async () => {
    await initHandLandmarker()
    startCamera()

    // [Security] Listen for tab visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange)
  })

  onBeforeUnmount(() => {
    stopCamera()

    // Terminate the inference worker
    if (inferenceWorker) {
      inferenceWorker.postMessage({ type: 'TERMINATE' })
      inferenceWorker.terminate()
      inferenceWorker = null
    }

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
