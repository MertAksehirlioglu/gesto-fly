<script setup lang="ts">
  import { ref, watch } from 'vue'

  const props = defineProps<{
    cursorPos: { x: number; y: number }
    score: number
    timeLeft: number
    isInfinite: boolean
  }>()

  const emit = defineEmits<{
    (e: 'exit'): void
  }>()

  const btnExit = ref<HTMLElement | null>(null)

  const hoverState = ref({
    target: null as string | null,
    startTime: 0,
    progress: 0,
  })

  let animationFrame: number | null = null

  watch(
    () => props.cursorPos,
    (newPos) => {
      checkButtons(newPos.x, newPos.y)
    },
  )

  const checkButtons = (x: number, y: number) => {
    if (!btnExit.value) return

    const rect = btnExit.value.getBoundingClientRect()
    const isHover =
      x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom

    if (isHover) {
      if (hoverState.value.target !== 'EXIT') {
        hoverState.value.target = 'EXIT'
        hoverState.value.startTime = performance.now()
        hoverState.value.progress = 0
        if (!animationFrame) loopHover()
      }
    } else {
      hoverState.value.target = null
      hoverState.value.progress = 0
      if (animationFrame) {
        cancelAnimationFrame(animationFrame)
        animationFrame = null
      }
    }
  }

  const loopHover = () => {
    if (!hoverState.value.target) {
      animationFrame = null
      return
    }

    const elapsed = performance.now() - hoverState.value.startTime
    const duration = 1500

    hoverState.value.progress = Math.min((elapsed / duration) * 100, 100)

    if (elapsed >= duration) {
      emit('exit')
      hoverState.value.target = null
      hoverState.value.progress = 0
      animationFrame = null
    } else {
      animationFrame = requestAnimationFrame(loopHover)
    }
  }
</script>

<template>
  <div class="hud">
    <div class="score-board">
      <div class="label">SCORE</div>
      <div class="value">{{ score }}</div>
    </div>

    <div
      class="timer-board"
      :class="{ critical: !isInfinite && timeLeft <= 10 }"
    >
      <div class="label">TIME</div>
      <div class="value">{{ isInfinite ? '∞' : timeLeft }}</div>
    </div>

    <button
      ref="btnExit"
      class="exit-btn"
      :class="{ hovering: hoverState.target === 'EXIT' }"
      @click="emit('exit')"
    >
      EXIT
      <div
        v-if="hoverState.target === 'EXIT'"
        class="btn-progress"
        :style="{ width: hoverState.progress + '%' }"
      ></div>
    </button>
  </div>
</template>

<style scoped>
  .hud {
    position: absolute;
    top: 20px;
    left: 20px;
    display: flex;
    gap: 20px;
    z-index: 50;
    pointer-events: none;
  }
  .hud button {
    pointer-events: auto;
  }

  .score-board,
  .timer-board {
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    padding: 10px 20px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    text-align: center;
    color: white;
  }

  .label {
    font-size: 0.7rem;
    opacity: 0.8;
    font-weight: bold;
  }
  .value {
    font-size: 1.8rem;
    font-weight: 800;
  }
  .timer-board.critical .value {
    color: #ff4757;
    animation: pulse 1s infinite;
  }

  .exit-btn {
    background: rgba(255, 0, 0, 0.5);
    color: white;
    border: none;
    padding: 15px 30px;
    border-radius: 12px;
    font-size: 1.2rem;
    font-weight: bold;
    cursor: pointer;
    backdrop-filter: blur(4px);
    position: relative;
    overflow: hidden;
    transition: transform 0.2s;
    margin: 0;
    line-height: normal;
  }

  .exit-btn.hovering {
    transform: scale(1.1);
    background: rgba(255, 0, 0, 0.7);
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
