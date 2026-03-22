<script setup lang="ts">
  import { ref, watch } from 'vue'
  import { useGestureDwell } from '../../composables/useGestureDwell'
  import { useFullscreen } from '../../composables/useFullscreen'

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

  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen()

  // Refs
  const btnCompetitive = ref<HTMLElement | null>(null)
  const btnPractice = ref<HTMLElement | null>(null)
  const btnLeaderboard = ref<HTMLElement | null>(null)
  const btnRecalibrate = ref<HTMLElement | null>(null)
  const btnFullscreen = ref<HTMLElement | null>(null)

  const competitiveDwell = useGestureDwell({
    onComplete: () => emit('start-competitive'),
  })
  const practiceDwell = useGestureDwell({
    onComplete: () => emit('start-practice'),
  })
  const leaderboardDwell = useGestureDwell({
    onComplete: () => emit('show-leaderboard'),
  })
  const recalibrateDwell = useGestureDwell({
    onComplete: () => emit('recalibrate'),
  })
  const fullscreenDwell = useGestureDwell({ onComplete: toggleFullscreen })

  watch(
    () => props.cursorPos,
    (newPos) => {
      checkButtons(newPos.x, newPos.y)
    },
  )

  const checkButtons = (x: number, y: number) => {
    const buttons = [
      { el: btnCompetitive.value, dwell: competitiveDwell },
      { el: btnPractice.value, dwell: practiceDwell },
      { el: btnLeaderboard.value, dwell: leaderboardDwell },
      { el: btnRecalibrate.value, dwell: recalibrateDwell },
      { el: btnFullscreen.value, dwell: fullscreenDwell },
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
    <h1 class="game-title">GESTO FLY</h1>

    <div class="menu-content">
      <div class="menu-buttons">
        <!-- Competitive Button -->
        <button
          ref="btnCompetitive"
          class="menu-btn primary"
          :class="{ hovering: competitiveDwell.isActive.value }"
          @click="emit('start-competitive')"
        >
          <span class="btn-title">COMPETITIVE</span>
          <span class="btn-sub">30s Timer • Ranked</span>
          <div
            v-if="competitiveDwell.isActive.value"
            class="btn-progress"
            :style="{ width: competitiveDwell.progress.value + '%' }"
          ></div>
        </button>

        <!-- Practice Button -->
        <button
          ref="btnPractice"
          class="menu-btn secondary"
          :class="{ hovering: practiceDwell.isActive.value }"
          @click="emit('start-practice')"
        >
          <span class="btn-title">PRACTICE</span>
          <span class="btn-sub">No Timer • Free Throw</span>
          <div
            v-if="practiceDwell.isActive.value"
            class="btn-progress"
            :style="{ width: practiceDwell.progress.value + '%' }"
          ></div>
        </button>

        <!-- Leaderboard Button -->
        <button
          ref="btnLeaderboard"
          class="menu-btn tertiary"
          :class="{ hovering: leaderboardDwell.isActive.value }"
          @click="emit('show-leaderboard')"
        >
          LEADERBOARD 🏆
          <div
            v-if="leaderboardDwell.isActive.value"
            class="btn-progress"
            :style="{ width: leaderboardDwell.progress.value + '%' }"
          ></div>
        </button>

        <!-- Recalibrate Button -->
        <button
          ref="btnRecalibrate"
          class="menu-btn tertiary recalibrate"
          :class="{ hovering: recalibrateDwell.isActive.value }"
          @click="emit('recalibrate')"
        >
          RECALIBRATE 🎯
          <div
            v-if="recalibrateDwell.isActive.value"
            class="btn-progress"
            :style="{ width: recalibrateDwell.progress.value + '%' }"
          ></div>
        </button>

        <!-- Fullscreen Button -->
        <button
          ref="btnFullscreen"
          class="menu-btn tertiary fullscreen"
          :class="{ hovering: fullscreenDwell.isActive.value }"
          @click="toggleFullscreen"
        >
          {{ isFullscreen ? 'EXIT FULLSCREEN ⛶' : 'FULLSCREEN ⛶' }}
          <div
            v-if="fullscreenDwell.isActive.value"
            class="btn-progress"
            :style="{ width: fullscreenDwell.progress.value + '%' }"
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

  .menu-btn.fullscreen {
    border-color: rgba(100, 180, 255, 0.5);
    color: rgba(130, 200, 255, 0.9);
    font-size: 0.85rem;
  }

  .menu-btn.fullscreen:hover,
  .menu-btn.fullscreen.hovering {
    border-color: rgba(130, 200, 255, 0.9);
    color: rgb(130, 200, 255);
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
