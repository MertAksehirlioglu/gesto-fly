<script setup lang="ts">
  import { onMounted, onBeforeUnmount, ref } from 'vue'
  import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'

  const videoRef = ref<HTMLVideoElement | null>(null)
  const canvasRef = ref<HTMLCanvasElement | null>(null)
  const isCameraActive = ref(false)
  let handLandmarker: HandLandmarker | null = null
  let animationFrameId: number | null = null

  const initHandLandmarker = async () => {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
    )
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numHands: 1,
    })
  }

  const startCamera = async () => {
    if (!handLandmarker || !videoRef.value) {
      console.log('Wait! handLandmarker not loaded yet.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 640,
          height: 480,
        },
      })

      if (videoRef.value) {
        videoRef.value.srcObject = stream
        videoRef.value.addEventListener('loadeddata', predictWebcam)
        isCameraActive.value = true
      }
    } catch (error) {
      console.error('Error accessing webcam:', error)
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

    if (results.landmarks && results.landmarks.length > 0) {
      const landmarks = results.landmarks[0]


      // Gesture Logic
      // Index tip: 8, Thumb tip: 4
      const indexTip = landmarks[8]
      const thumbTip = landmarks[4]

      const distance = Math.hypot(
        indexTip.x - thumbTip.x,
        indexTip.y - thumbTip.y,
      )
      // Dynamic pinch threshold — from calibration or fallback default
      const pinchThreshold = props.pinchThreshold ?? 0.03

      // Emit raw distance every frame for calibration overlay
      emit('pinchDistance', distance)

      const centerX = (indexTip.x + thumbTip.x) / 2
      const centerY = (indexTip.y + thumbTip.y) / 2

      // Map to visual coordinates (Mirrored)
      const visualX = 1 - centerX
      const visualY = centerY

      // Cursor Logic (Index Finger Tip)
      const cursorVisualX = 1 - indexTip.x
      const cursorVisualY = indexTip.y

      // Always emit cursor position for UI interaction (Hover)
      emit('gesture', {
        type: 'cursorMove',
        x: cursorVisualX,
        y: cursorVisualY,
      })

      if (distance < pinchThreshold) {
        // Pinching - Cancel any pending release
        releaseFrameCount = 0

        if (!isPinching) {
          isPinching = true
          emit('gesture', { type: 'pinchStart', x: visualX, y: visualY })
        } else {
          emit('gesture', { type: 'pinchMove', x: visualX, y: visualY })
        }
      } else {
        // Releasing - Wait for buffer to clear jitter
        if (isPinching) {
          releaseFrameCount++
          if (releaseFrameCount >= 5) {
            // 5 frames ~80ms at 60fps
            isPinching = false
            releaseFrameCount = 0
            emit('gesture', { type: 'pinchEnd', x: visualX, y: visualY })
          } else {
            // Still nominally pinching during buffer, keep updating position
            emit('gesture', { type: 'pinchMove', x: visualX, y: visualY })
          }
        }
      }
    } else {
      // Hand lost
      if (isPinching) {
        isPinching = false
        releaseFrameCount = 0
        emit('gesture', { type: 'pinchEnd', x: 0, y: 0 })
      }

      // Clear canvas if hand lost
      const canvas = canvasRef.value
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    }

    if (isCameraActive.value) {
      animationFrameId = requestAnimationFrame(predictWebcam)
    }
  }

  // function drawLandmarks removed

  onMounted(async () => {
    await initHandLandmarker()
    startCamera()
  })

  onBeforeUnmount(() => {
    isCameraActive.value = false
    if (videoRef.value && videoRef.value.srcObject) {
      const stream = videoRef.value.srcObject as MediaStream
      const tracks = stream.getTracks()
      tracks.forEach((track) => track.stop())
    }
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId)
    }
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
</style>
