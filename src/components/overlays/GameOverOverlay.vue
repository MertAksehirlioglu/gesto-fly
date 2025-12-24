<script setup lang="ts">
  import { ref, watch } from 'vue'

  const props = defineProps<{
    cursorPos: { x: number; y: number }
    score: number
    gameMode: string
  }>()

  const emit = defineEmits<{
    (e: 'play-again'): void
    (e: 'menu'): void
  }>()

  const btnPlayAgain = ref<HTMLElement | null>(null)
  const btnMenu = ref<HTMLElement | null>(null)

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
    const buttons = [
      { id: 'PLAY_AGAIN', el: btnPlayAgain.value },
      { id: 'MENU', el: btnMenu.value },
    ]

    let found = null
    for (const btn of buttons) {
      if (btn.el) {
        const rect = btn.el.getBoundingClientRect()
        if (
          x >= rect.left &&
          x <= rect.right &&
          y >= rect.top &&
          y <= rect.bottom
        ) {
          found = btn.id
          break
        }
      }
    }

    if (found) {
      if (hoverState.value.target !== found) {
        hoverState.value.target = found
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
      if (hoverState.value.target === 'PLAY_AGAIN') emit('play-again')
      else if (hoverState.value.target === 'MENU') emit('menu')

      hoverState.value.target = null
      hoverState.value.progress = 0
      animationFrame = null
    } else {
      animationFrame = requestAnimationFrame(loopHover)
    }
  }
</script>

<template>
  <div class="overlay-screen">
    <div class="game-over-card">
      <h1>TIME'S UP!</h1>
      <div class="final-score">
        <span>Score:</span>
        <span class="highlight">{{ score }}</span>
      </div>
      <div v-if="gameMode === 'COMPETITIVE'" class="mode-info">
        Saved to Leaderboard!
      </div>

      <div class="game-over-actions">
        <button
          ref="btnPlayAgain"
          class="menu-btn primary"
          :class="{ hovering: hoverState.target === 'PLAY_AGAIN' }"
          @click="emit('play-again')"
        >
          PLAY AGAIN
          <div
            v-if="hoverState.target === 'PLAY_AGAIN'"
            class="btn-progress"
            :style="{ width: hoverState.progress + '%' }"
          ></div>
        </button>
        <button
          ref="btnMenu"
          class="menu-btn secondary"
          :class="{ hovering: hoverState.target === 'MENU' }"
          @click="emit('menu')"
        >
          MENU
          <div
            v-if="hoverState.target === 'MENU'"
            class="btn-progress"
            :style="{ width: hoverState.progress + '%' }"
          ></div>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .overlay-screen {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 200;
    pointer-events: auto;
  }

  .game-over-card {
    background: white;
    color: #333;
    padding: 40px;
    border-radius: 20px;
    text-align: center;
    animation: slideUp 0.3s ease-out;
    min-width: 350px;
  }

  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .final-score {
    font-size: 2rem;
    margin: 10px 0;
  }
  .highlight {
    font-weight: 900;
    color: #e74c3c;
    font-size: 3rem;
    margin-left: 10px;
  }

  .game-over-actions {
    display: flex;
    gap: 15px;
    margin-top: 20px;
    justify-content: center;
    align-items: center;
    width: 100%;
  }

  .menu-btn {
    padding: 15px 30px;
    border-radius: 12px;
    border: none;
    cursor: pointer;
    text-transform: uppercase;
    font-weight: bold;
    color: white;
    transition: transform 0.2s;
    text-align: center;
    flex: 0 1 auto;
    min-width: 140px;
    position: relative;
    overflow: hidden;
  }

  .menu-btn.hovering {
    transform: scale(1.05);
  }

  .menu-btn.primary {
    background: linear-gradient(135deg, #e74c3c, #c0392b);
    font-size: 1.2rem;
  }
  .menu-btn.secondary {
    background: #555;
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
