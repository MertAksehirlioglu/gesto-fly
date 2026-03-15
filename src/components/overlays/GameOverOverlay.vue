<script setup lang="ts">
  import { ref, watch } from 'vue'
  import { useGestureDwell } from '../../composables/useGestureDwell'

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

  const playAgainDwell = useGestureDwell({
    onComplete: () => emit('play-again'),
  })
  const menuDwell = useGestureDwell({ onComplete: () => emit('menu') })

  watch(
    () => props.cursorPos,
    (newPos) => {
      checkButtons(newPos.x, newPos.y)
    },
  )

  const checkButtons = (x: number, y: number) => {
    const buttons = [
      { el: btnPlayAgain.value, dwell: playAgainDwell },
      { el: btnMenu.value, dwell: menuDwell },
    ]

    for (const btn of buttons) {
      if (btn.el) {
        const rect = btn.el.getBoundingClientRect()
        const isHover =
          x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
        if (isHover) {
          btn.dwell.startDwell()
        } else {
          btn.dwell.cancelDwell()
        }
      }
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
          :class="{ hovering: playAgainDwell.isActive.value }"
          @click="emit('play-again')"
        >
          PLAY AGAIN
          <div
            v-if="playAgainDwell.isActive.value"
            class="btn-progress"
            :style="{ width: playAgainDwell.progress.value + '%' }"
          ></div>
        </button>
        <button
          ref="btnMenu"
          class="menu-btn secondary"
          :class="{ hovering: menuDwell.isActive.value }"
          @click="emit('menu')"
        >
          MENU
          <div
            v-if="menuDwell.isActive.value"
            class="btn-progress"
            :style="{ width: menuDwell.progress.value + '%' }"
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
