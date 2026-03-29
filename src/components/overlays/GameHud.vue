<script setup lang="ts">
  import { ref, watch } from 'vue'
  import { useGestureDwell } from '../../composables/useGestureDwell'
  import { useGameAudio } from '../../composables/useGameAudio'
  import { useFullscreen } from '../../composables/useFullscreen'

  const props = defineProps<{
    cursorPos: { x: number; y: number }
    score: number
    streak: number
    timeLeft: number
    isInfinite: boolean
    celebrating?: boolean
  }>()

  const emit = defineEmits<{
    (e: 'exit'): void
  }>()

  const btnExit = ref<HTMLElement | null>(null)
  const btnMute = ref<HTMLElement | null>(null)
  const btnFullscreen = ref<HTMLElement | null>(null)

  const { muted, toggleMute } = useGameAudio()
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen()

  const exitDwell = useGestureDwell({ onComplete: () => emit('exit') })
  const muteDwell = useGestureDwell({ onComplete: toggleMute })
  const fullscreenDwell = useGestureDwell({ onComplete: toggleFullscreen })

  watch(
    () => props.cursorPos,
    (newPos) => {
      checkButtons(newPos.x, newPos.y)
    },
  )

  const checkButtons = (x: number, y: number) => {
    const buttons = [
      { el: btnExit.value, dwell: exitDwell },
      { el: btnMute.value, dwell: muteDwell },
      { el: btnFullscreen.value, dwell: fullscreenDwell },
    ]
    for (const btn of buttons) {
      if (btn.el) {
        const rect = btn.el.getBoundingClientRect()
        const isHover =
          x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
        if (isHover) btn.dwell.startDwell()
        else btn.dwell.cancelDwell()
      }
    }
  }
</script>

<template>
  <div class="hud">
    <div class="score-board">
      <div class="label">SCORE</div>
      <div class="value" :class="{ 'score-bounce': celebrating }">
        {{ score }}
      </div>
    </div>

    <div
      class="timer-board"
      :class="{ critical: !isInfinite && timeLeft <= 10 }"
    >
      <div class="label">TIME</div>
      <div class="value">{{ isInfinite ? '∞' : timeLeft }}</div>
    </div>

    <div v-if="streak > 1" class="streak-board">
      <div class="label">🔥 STREAK</div>
      <div class="value streak-glow">{{ streak }}x</div>
    </div>

    <button
      ref="btnExit"
      class="exit-btn"
      :class="{ hovering: exitDwell.isActive.value }"
      @click="emit('exit')"
    >
      EXIT
      <div
        v-if="exitDwell.isActive.value"
        class="btn-progress"
        :style="{ width: exitDwell.progress.value + '%' }"
      ></div>
    </button>

    <button
      ref="btnMute"
      class="mute-btn"
      :class="{ hovering: muteDwell.isActive.value }"
      :title="muted ? 'Unmute' : 'Mute'"
      @click="toggleMute"
    >
      {{ muted ? '🔇' : '🔊' }}
      <div
        v-if="muteDwell.isActive.value"
        class="btn-progress"
        :style="{ width: muteDwell.progress.value + '%' }"
      ></div>
    </button>

    <button
      ref="btnFullscreen"
      class="fullscreen-btn"
      :class="{ hovering: fullscreenDwell.isActive.value }"
      :title="isFullscreen ? 'Exit fullscreen' : 'Fullscreen'"
      @click="toggleFullscreen"
    >
      {{ isFullscreen ? '⛶' : '⛶' }}
      <div
        v-if="fullscreenDwell.isActive.value"
        class="btn-progress"
        :style="{ width: fullscreenDwell.progress.value + '%' }"
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

  /* [Feature] Score bounce animation on basket */
  .value.score-bounce {
    animation: scorePop 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
    color: #ffd700;
  }

  @keyframes scorePop {
    0% {
      transform: scale(1);
    }
    40% {
      transform: scale(1.6);
    }
    70% {
      transform: scale(0.9);
    }
    100% {
      transform: scale(1);
    }
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

  .mute-btn {
    background: rgba(0, 0, 0, 0.5);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
    padding: 8px 12px;
    border-radius: 10px;
    font-size: 1.1rem;
    cursor: pointer;
    backdrop-filter: blur(4px);
    line-height: normal;
    position: relative;
    overflow: hidden;
    transition: transform 0.15s;
  }
  .mute-btn.hovering {
    transform: scale(1.1);
    border-color: rgba(255, 255, 255, 0.8);
  }

  .fullscreen-btn {
    background: rgba(0, 0, 0, 0.5);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
    padding: 8px 12px;
    border-radius: 10px;
    font-size: 1.1rem;
    cursor: pointer;
    backdrop-filter: blur(4px);
    line-height: normal;
    position: relative;
    overflow: hidden;
    transition: transform 0.15s;
  }
  .fullscreen-btn.hovering {
    transform: scale(1.1);
    border-color: rgba(255, 255, 255, 0.8);
  }

  .streak-board {
    background: rgba(255, 100, 0, 0.7);
    backdrop-filter: blur(4px);
    padding: 10px 20px;
    border-radius: 12px;
    border: 1px solid rgba(255, 200, 0, 0.5);
    text-align: center;
    color: white;
  }

  .streak-glow {
    color: #ffd700;
    text-shadow:
      0 0 10px rgba(255, 200, 0, 0.8),
      0 0 20px rgba(255, 100, 0, 0.5);
    animation: streakPulse 0.8s ease-in-out infinite alternate;
  }

  @keyframes streakPulse {
    from {
      text-shadow:
        0 0 10px rgba(255, 200, 0, 0.8),
        0 0 20px rgba(255, 100, 0, 0.5);
    }
    to {
      text-shadow:
        0 0 20px rgba(255, 200, 0, 1),
        0 0 40px rgba(255, 100, 0, 0.9);
    }
  }
</style>
