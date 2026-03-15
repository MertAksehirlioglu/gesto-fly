<script setup lang="ts">
  import { onMounted, onUnmounted, ref, watch } from 'vue'
  import { useGestureDwell } from '../../composables/useGestureDwell'

  const isMobile = ref(false)
  const dismissed = ref(false)

  const props = defineProps<{
    cursorPos: { x: number; y: number }
  }>()

  const checkMobile = () => {
    // Check 1: User Agent (Phones/Tablets)
    const ua = navigator.userAgent.toLowerCase()
    const isMobileUA =
      /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)

    // Check 2: Screen Width (Small screens)
    const isSmallScreen = window.innerWidth < 1024

    if (isMobileUA || isSmallScreen) {
      isMobile.value = true
    }
  }

  const dismiss = () => {
    dismissed.value = true
  }

  const btnContinue = ref<HTMLElement | null>(null)
  const continueDwell = useGestureDwell({ onComplete: dismiss })

  watch(
    () => props.cursorPos,
    (pos) => {
      if (!btnContinue.value) return
      const rect = btnContinue.value.getBoundingClientRect()
      const isHover =
        pos.x >= rect.left &&
        pos.x <= rect.right &&
        pos.y >= rect.top &&
        pos.y <= rect.bottom
      if (isHover) continueDwell.startDwell()
      else continueDwell.cancelDwell()
    },
  )

  onMounted(() => {
    checkMobile()
    window.addEventListener('resize', checkMobile)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', checkMobile)
  })
</script>

<template>
  <div v-if="isMobile && !dismissed" class="mobile-warning">
    <div class="warning-card">
      <div class="icon">🖥️</div>
      <h1>Desktop Required</h1>
      <p>
        This game is designed for a large screen and requires a webcam for
        gesture controls.
      </p>
      <p class="sub">
        For the best experience, please play on a laptop or desktop computer.
      </p>

      <button
        ref="btnContinue"
        class="continue-btn"
        :class="{ hovering: continueDwell.isActive.value }"
        @click="dismiss"
      >
        I understand, continue anyway
        <div
          v-if="continueDwell.isActive.value"
          class="btn-progress"
          :style="{ width: continueDwell.progress.value + '%' }"
        ></div>
      </button>
    </div>
  </div>
</template>

<style scoped>
  .mobile-warning {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.95);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .warning-card {
    background: #1a1a1a;
    color: white;
    padding: 30px;
    border-radius: 20px;
    text-align: center;
    max-width: 400px;
    border: 1px solid #333;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  }

  .icon {
    font-size: 3rem;
    margin-bottom: 20px;
  }

  h1 {
    font-size: 1.8rem;
    margin-bottom: 15px;
    color: #e74c3c;
  }

  p {
    font-size: 1rem;
    line-height: 1.5;
    margin-bottom: 20px;
    opacity: 0.9;
  }

  .sub {
    font-size: 0.8rem;
    opacity: 0.6;
  }

  .continue-btn {
    margin-top: 10px;
    background: transparent;
    border: 1px solid #555;
    color: #aaa;
    padding: 10px 20px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.8rem;
    position: relative;
    overflow: hidden;
    transition: all 0.2s;
  }

  .continue-btn:hover,
  .continue-btn.hovering {
    border-color: white;
    color: white;
  }

  .btn-progress {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 4px;
    background: #00ff00;
    transition: width 0.1s linear;
  }
</style>
