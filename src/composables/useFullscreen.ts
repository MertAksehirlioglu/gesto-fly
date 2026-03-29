/**
 * useFullscreen
 *
 * Composable for toggling browser fullscreen mode.
 * Exposes `isFullscreen` (reactive), `toggle()`, and `request()`/`exit()`.
 * Handles vendor-prefixed APIs and the `fullscreenchange` event.
 */

import { ref, onMounted, onBeforeUnmount } from 'vue'

export function useFullscreen() {
  const isFullscreen = ref(false)

  const updateState = () => {
    isFullscreen.value = !!document.fullscreenElement
  }

  const request = () => {
    const el = document.documentElement
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {
        // Fullscreen may be blocked by browser policy — fail silently
      })
    }
  }

  const exit = () => {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {})
    }
  }

  const toggle = () => {
    if (isFullscreen.value) {
      exit()
    } else {
      request()
    }
  }

  onMounted(() => {
    document.addEventListener('fullscreenchange', updateState)
    updateState()
  })

  onBeforeUnmount(() => {
    document.removeEventListener('fullscreenchange', updateState)
  })

  return { isFullscreen, toggle, request, exit }
}
