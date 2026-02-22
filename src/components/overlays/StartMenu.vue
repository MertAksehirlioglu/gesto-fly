<script setup lang="ts">
  import { ref, watch } from 'vue'

  const props = defineProps<{
    cursorPos: { x: number; y: number }
    top3Scores: { score: number; team: string }[]
  }>()

  const emit = defineEmits<{
    (e: 'start-competitive'): void
    (e: 'start-practice'): void
    (e: 'show-leaderboard'): void
    (e: 'recalibrate'): void
  }>()

  // Refs
  const btnCompetitive = ref<HTMLElement | null>(null)
  const btnPractice = ref<HTMLElement | null>(null)
  const btnLeaderboard = ref<HTMLElement | null>(null)
  const btnRecalibrate = ref<HTMLElement | null>(null)

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
      { id: 'COMPETITIVE', el: btnCompetitive.value },
      { id: 'PRACTICE', el: btnPractice.value },
      { id: 'LEADERBOARD', el: btnLeaderboard.value },
      { id: 'RECALIBRATE', el: btnRecalibrate.value },
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
    const duration = 1500 // 1.5 seconds

    hoverState.value.progress = Math.min((elapsed / duration) * 100, 100)

    if (elapsed >= duration) {
      triggerAction(hoverState.value.target)
      hoverState.value.target = null
      hoverState.value.progress = 0
      animationFrame = null
    } else {
      animationFrame = requestAnimationFrame(loopHover)
    }
  }

  const triggerAction = (action: string) => {
    if (action === 'COMPETITIVE') emit('start-competitive')
    else if (action === 'PRACTICE') emit('start-practice')
    else if (action === 'LEADERBOARD') emit('show-leaderboard')
    else if (action === 'RECALIBRATE') emit('recalibrate')
  }
</script>

<template>
  <div class="overlay-screen">
    <h1 class="game-title">GESTO FLY</h1>

    <div class="menu-content">
      <div class="menu-buttons">
        <!-- Competitive Button -->
        <button
          ref="btnCompetitive"
          class="menu-btn primary"
          :class="{ hovering: hoverState.target === 'COMPETITIVE' }"
          @click="emit('start-competitive')"
        >
          <span class="btn-title">COMPETITIVE</span>
          <span class="btn-sub">30s Timer • Ranked</span>
          <div
            v-if="hoverState.target === 'COMPETITIVE'"
            class="btn-progress"
            :style="{ width: hoverState.progress + '%' }"
          ></div>
        </button>

        <!-- Practice Button -->
        <button
          ref="btnPractice"
          class="menu-btn secondary"
          :class="{ hovering: hoverState.target === 'PRACTICE' }"
          @click="emit('start-practice')"
        >
          <span class="btn-title">PRACTICE</span>
          <span class="btn-sub">No Timer • Free Throw</span>
          <div
            v-if="hoverState.target === 'PRACTICE'"
            class="btn-progress"
            :style="{ width: hoverState.progress + '%' }"
          ></div>
        </button>

        <!-- Leaderboard Button -->
        <button
          ref="btnLeaderboard"
          class="menu-btn tertiary"
          :class="{ hovering: hoverState.target === 'LEADERBOARD' }"
          @click="emit('show-leaderboard')"
        >
          LEADERBOARD 🏆
          <div
            v-if="hoverState.target === 'LEADERBOARD'"
            class="btn-progress"
            :style="{ width: hoverState.progress + '%' }"
          ></div>
        </button>

        <!-- Recalibrate Button -->
        <button
          ref="btnRecalibrate"
          class="menu-btn tertiary recalibrate"
          :class="{ hovering: hoverState.target === 'RECALIBRATE' }"
          @click="emit('recalibrate')"
        >
          RECALIBRATE 🎯
          <div
            v-if="hoverState.target === 'RECALIBRATE'"
            class="btn-progress"
            :style="{ width: hoverState.progress + '%' }"
          ></div>
        </button>
      </div>

      <!-- Mini Leaderboard -->
      <div v-if="top3Scores.length > 0" class="mini-leaderboard">
        <div class="mini-title">TOP SCORERS</div>
        <div v-for="(entry, idx) in top3Scores" :key="idx" class="mini-row">
          <span class="mini-rank">{{ idx + 1 }}</span>
          <span class="mini-team">{{ entry.team }}</span>
          <span class="mini-score">{{ entry.score }}</span>
        </div>
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

  .game-title {
    font-family: 'Arial Black', sans-serif;
    font-size: 3rem;
    color: white;
    margin-bottom: 40px;
    letter-spacing: 5px;
    text-shadow: 0 5px 15px rgba(0, 0, 0, 0.5);
    font-style: italic;
  }

  .menu-content {
    display: flex;
    gap: 40px;
    align-items: flex-start;
  }

  .menu-buttons {
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 300px;
  }

  .menu-btn {
    padding: 15px 30px;
    border-radius: 12px;
    border: none;
    cursor: pointer;
    text-transform: uppercase;
    font-weight: bold;
    color: white;
    transition:
      transform 0.2s,
      box-shadow 0.2s;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
  }

  .menu-btn.hovering {
    transform: scale(1.05);
    box-shadow: 0 0 15px rgba(255, 255, 255, 0.4);
  }

  .menu-btn.primary {
    background: linear-gradient(135deg, #e74c3c, #c0392b);
    font-size: 1.2rem;
  }

  .menu-btn.secondary {
    background: rgba(255, 255, 255, 0.2);
    border: 2px solid white;
  }

  .menu-btn.tertiary {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.5);
    margin-top: 10px;
  }

  .btn-title {
    font-weight: 900;
  }
  .btn-sub {
    font-size: 0.7rem;
    font-weight: normal;
    opacity: 0.8;
  }

  .btn-progress {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 4px;
    background: #00ff00;
    transition: width 0.1s linear;
  }

  .menu-btn.recalibrate {
    border-color: rgba(255, 140, 0, 0.5);
    color: rgba(255, 165, 0, 0.9);
    font-size: 0.85rem;
  }

  .menu-btn.recalibrate:hover,
  .menu-btn.recalibrate.hovering {
    border-color: orange;
    color: orange;
  }

  .mini-leaderboard {
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(10px);
    padding: 20px;
    border-radius: 16px;
    width: 250px;
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .mini-title {
    font-size: 0.8rem;
    font-weight: bold;
    letter-spacing: 2px;
    text-align: center;
    margin-bottom: 15px;
    opacity: 0.8;
  }

  .mini-row {
    display: flex;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    font-size: 0.9rem;
  }

  .mini-rank {
    font-weight: bold;
    color: #e74c3c;
    width: 20px;
  }
  .mini-team {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mini-score {
    font-weight: bold;
  }
</style>
