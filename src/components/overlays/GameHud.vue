<script setup lang="ts">
  import { ref, watch } from 'vue'
  import { useGestureDwell } from '../../composables/useGestureDwell'
  import { useGameAudio } from '../../composables/useGameAudio'

  const props = defineProps<{
    cursorPos: { x: number; y: number }
    score: number
    timeLeft: number
    isInfinite: boolean
    celebrating?: boolean
  }>()

  const emit = defineEmits<{
    (e: 'exit'): void
  }>()

  const btnExit = ref<HTMLElement | null>(null)

  const exitDwell = useGestureDwell({ onComplete: () => emit('exit') })
  const { muted, toggleMute } = useGameAudio()

  watch(
    () => props.cursorPos,
    (newPos) => {
      checkButtons(newPos.x, newPos.y)
    },
  )

  const checkButtons = (x: number, y: number) => {
    if (!btnExit.value) return
    const rect = btnExit.value.getBoundingClientRect()
    const isHover = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
    if (isHover) {
      exitDwell.startDwell()
    } else {
      exitDwell.cancelDwell()
    }
  }
</script>

<template>
  <div class="hud">
    <div class="score-board">
      <div class="label">SCORE</div>
      <div class="value" :class="{ 'score-bounce': celebrating }">{{ score }}</div>
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

    <button class="mute-btn" @click="toggleMute" :title="muted ? 'Unmute' : 'Mute'">
      {{ muted ? '🔇' : '🔊' }}
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
    color: #FFD700;
  }

  @keyframes scorePop {
    0%   { transform: scale(1); }
    40%  { transform: scale(1.6); }
    70%  { transform: scale(0.9); }
    100% { transform: scale(1); }
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
    transition: transform 0.15s;
  }
  .mute-btn:hover {
    transform: scale(1.1);
  }
</style>
