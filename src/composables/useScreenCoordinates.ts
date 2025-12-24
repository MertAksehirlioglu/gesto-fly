import { ref, onMounted, onUnmounted } from 'vue'

export function useScreenCoordinates(videoRatio: number = 4 / 3) {
  const windowSize = ref({
    width: window.innerWidth,
    height: window.innerHeight,
  })

  const updateSize = () => {
    windowSize.value = { width: window.innerWidth, height: window.innerHeight }
  }

  onMounted(() => {
    window.addEventListener('resize', updateSize)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', updateSize)
  })

  /**
   * Transforms normalized (0-1) video coordinates to screen pixel coordinates
   * accounting for object-fit: cover scaling
   */
  const transform = (normalizedX: number, normalizedY: number) => {
    const screenW = windowSize.value.width
    const screenH = windowSize.value.height
    const screenRatio = screenW / screenH

    let pixelX = 0
    let pixelY = 0

    if (screenRatio > videoRatio) {
      // Screen is wider than video (Letterbox top/bottom? No, cover means crop top/bottom)
      // Actually, if screen is WIDER (e.g. 16:9 vs 4:3), 'cover' matches WIDTH.
      // So Height is CROPPED.
      // Wait, let's re-verify the logic in App.vue:
      /*
        if (screenRatio > videoRatio) {
           const visualHeight = window.innerWidth / videoRatio;
           const topOffset = (window.innerHeight - visualHeight) / 2;
           // ...
        }
      */
      // If screen is wider (16:9 > 4:3):
      // video fits width. height is larger than screen (if preserving ratio).
      // e.g. 1600x900 screen. Video 4:3 -> 1600 / (4/3) = 1200 height.
      // 1200 > 900. So we have 1200 height video appearing on 900 height screen.
      // Top offset is (900 - 1200) / 2 = -150.
      // Coordinates: y * visualHeight + topOffset.

      const visualHeight = screenW / videoRatio
      const topOffset = (screenH - visualHeight) / 2

      pixelX = normalizedX * screenW
      pixelY = topOffset + normalizedY * visualHeight
    } else {
      // Screen is taller (Narrower) than video (e.g. Mobile Portrait)
      // Height matches. Width is cropped (offset left).

      const visualWidth = screenH * videoRatio
      const leftOffset = (screenW - visualWidth) / 2

      pixelX = leftOffset + normalizedX * visualWidth
      pixelY = normalizedY * screenH
    }

    return { x: pixelX, y: pixelY }
  }

  return {
    transform,
  }
}
