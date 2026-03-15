<script setup lang="ts">
  import { ref, watch } from 'vue'
  import { useGestureDwell } from '../../composables/useGestureDwell'

  const props = defineProps<{
    cursorPos: { x: number; y: number }
    leaderboard: { score: number; team: string; date: string }[]
  }>()

  const emit = defineEmits<{
    (e: 'back'): void
  }>()

  const btnBack = ref<HTMLElement | null>(null)

  const backDwell = useGestureDwell({ onComplete: () => emit('back') })

  watch(
    () => props.cursorPos,
    (newPos) => {
      checkButtons(newPos.x, newPos.y)
    },
  )

  const checkButtons = (x: number, y: number) => {
    if (!btnBack.value) return
    const rect = btnBack.value.getBoundingClientRect()
    const isHover =
      x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
    if (isHover) {
      backDwell.startDwell()
    } else {
      backDwell.cancelDwell()
    }
  }
</script>

<template>
  <div class="overlay-screen">
    <div class="leaderboard-card">
      <h2>TOP 10 SCORES</h2>
      <div class="list-container">
        <div v-if="leaderboard.length === 0" class="empty-state">
          No scores yet!
        </div>
        <div v-for="(entry, idx) in leaderboard" :key="idx" class="lb-row">
          <span class="rank">#{{ idx + 1 }}</span>
          <span class="team">{{ entry.team }}</span>
          <span class="score">{{ entry.score }}</span>
        </div>
      </div>
      <button
        ref="btnBack"
        class="menu-btn back-btn"
        :class="{ hovering: backDwell.isActive.value }"
        @click="emit('back')"
      >
        BACK
        <div
          v-if="backDwell.isActive.value"
          class="btn-progress"
          :style="{ width: backDwell.progress.value + '%' }"
        ></div>
      </button>
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

  .leaderboard-card {
    background: white;
    padding: 30px;
    border-radius: 20px;
    width: 90%;
    max-width: 400px;
    color: #333;
  }

  .leaderboard-card h2 {
    text-align: center;
    margin-bottom: 20px;
    border-bottom: 2px solid #eee;
    padding-bottom: 10px;
  }

  .list-container {
    max-height: 60vh; /* Use vh to ensure it fits */
    overflow-y: hidden; /* Disable scrolling as requested */
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
  }

  .lb-row {
    display: flex;
    justify-content: space-between;
    padding: 4px 0; /* Reduced padding for density */
    border-bottom: 1px solid #eee;
    font-weight: bold;
    font-size: 0.9rem; /* Slightly smaller text */
  }

  .lb-row .rank {
    width: 30px;
    color: #888;
  }
  .lb-row .team {
    flex: 1;
    text-align: left;
  }
  .lb-row .score {
    color: #e74c3c;
    width: 40px;
    text-align: right;
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
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
  }

  .menu-btn.hovering {
    transform: scale(1.05);
  }

  .back-btn {
    margin-top: 20px;
    background: #555;
    width: 100%;
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
