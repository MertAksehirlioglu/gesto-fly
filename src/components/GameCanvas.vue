```
<script setup lang="ts">
  import { onMounted, onUnmounted, ref, nextTick, computed } from 'vue'
  import { GameWorld } from '../game/GameWorld'
  import StartMenu from './overlays/StartMenu.vue'
  import GameHud from './overlays/GameHud.vue'
  import GameOverOverlay from './overlays/GameOverOverlay.vue'
  import LeaderboardOverlay from './overlays/LeaderboardOverlay.vue'
  import CalibrationOverlay from './overlays/CalibrationOverlay.vue'
  import { useCalibration } from '../composables/useCalibration'


  const props = defineProps<{
    currentTeamName: string
  }>()

  // --- Calibration ---
  const { isCalibrated, pinchThreshold, throwMultiplier, finalize } = useCalibration()
  const latestPinchDistance = ref(0)

  const handlePinchDistance = (d: number) => {
    latestPinchDistance.value = d
  }

  const onCalibrationComplete = (payload: { min: number; max: number }) => {
    finalize(payload.min, payload.max)
    if (gameWorld) {
      gameWorld.throwMultiplier = throwMultiplier.value
    }
    gameState.value = 'MENU'
  }

  const onCalibrationSkip = () => {
    gameState.value = 'MENU'
  }

  // --- State ---
  const canvasRef = ref<HTMLCanvasElement | null>(null)
  let gameWorld: GameWorld | null = null

  // Game States
  type GameState = 'CALIBRATING' | 'MENU' | 'PLAYING' | 'GAME_OVER' | 'LEADERBOARD'
  type GameMode = 'COMPETITIVE' | 'PRACTICE'

  const gameState = ref<GameState>(isCalibrated.value ? 'MENU' : 'CALIBRATING')
  const gameMode = ref<GameMode>('COMPETITIVE')

  // Game Data
  const score = ref(0)
  const timeLeft = ref(30) // Default 30s for Competitive
  const isInfinite = ref(false)

  // Leaderboard Data
  interface ScoreEntry {
    score: number
    team: string
    date: string
  }
  const leaderboard = ref<ScoreEntry[]>([])
  const highScore = ref(0) // Best score for simple display

  // Computed for UI
  const top3Scores = computed(() => leaderboard.value.slice(0, 3))

  // Timer
  let timerInterval: ReturnType<typeof setInterval> | null = null

  // --- Persistence ---
  const STORAGE_KEY_LEADERBOARD = 'gesto-fly-leaderboard'

  const loadLeaderboard = () => {
    const saved = localStorage.getItem(STORAGE_KEY_LEADERBOARD)
    if (saved) {
      try {
        leaderboard.value = JSON.parse(saved)
        // Sort just in case
        leaderboard.value.sort((a, b) => b.score - a.score)
        if (leaderboard.value.length > 0) {
          highScore.value = leaderboard.value[0].score
        }
      } catch (e) {
        console.error('Failed to load leaderboard', e)
        leaderboard.value = []
      }
    }
  }

  const saveToLeaderboard = () => {
    // Only save competitive scores > 0
    if (gameMode.value !== 'COMPETITIVE' || score.value <= 0) return

    const newEntry: ScoreEntry = {
      score: score.value,
      team: props.currentTeamName, // Use prop
      date: new Date().toLocaleDateString(),
    }

    leaderboard.value.push(newEntry)
    leaderboard.value.sort((a, b) => b.score - a.score)

    // Keep top 10
    if (leaderboard.value.length > 10) {
      leaderboard.value = leaderboard.value.slice(0, 10)
    }

    localStorage.setItem(
      STORAGE_KEY_LEADERBOARD,
      JSON.stringify(leaderboard.value),
    )

    // Update simple high score ref
    if (leaderboard.value.length > 0) {
      highScore.value = leaderboard.value[0].score
    }
  }

  // --- Game Control ---
  const startGame = (mode: GameMode) => {
    gameMode.value = mode
    gameState.value = 'PLAYING'
    score.value = 0

    if (mode === 'COMPETITIVE') {
      timeLeft.value = 30
      isInfinite.value = false
    } else {
      timeLeft.value = 0
      isInfinite.value = true
    }

    // Reset Physics
    if (gameWorld) {
      gameWorld.resetBall()
    }

    if (timerInterval) clearInterval(timerInterval)

    if (!isInfinite.value) {
      timerInterval = setInterval(() => {
        timeLeft.value--
        if (timeLeft.value <= 0) {
          endGame()
        }
      }, 1000)
    }
  }

  const endGame = () => {
    if (timerInterval) clearInterval(timerInterval)
    gameState.value = 'GAME_OVER'
    saveToLeaderboard()
  }

  const onScore = () => {


    if (gameState.value === 'PLAYING') {
      score.value++
    }
  }

  const showLeaderboard = () => {
    gameState.value = 'LEADERBOARD'
  }

  const backToMenu = () => {
    gameState.value = 'MENU'
  }

  // --- Gestures ---
  // We need pointer cursor emulation for menu buttons if using gestures
  // Currently UI is click-based for simplicity unless "Index Finger Interaction" is strictly required for menu.
  // The user didn't explicitly demand "Gesture Menu", but "Restart Button" had index finger interaction.
  // Let's rely on standard clicks for the detailed menu for now to ensure reliability,
  // as gesture menus are complex. Or use cursor hover like TeamSelector.
  // Emulating "Hover" for menu buttons is good for consistency.
  const cursorP = ref({ x: 0, y: 0 })

  // Hover state is now managed inside child components! We only pass position.

  const handleGesture = (gesture: { type: string; x: number; y: number }) => {
    if (!gameWorld) return
    // Coordinates are already pixels from App.vue (transformed for letterboxing)
    const px = gesture.x
    const py = gesture.y
    cursorP.value = { x: px, y: py }

    if (gameState.value === 'PLAYING') {
      // Physics interactions
      if (gesture.type === 'cursorMove') {
        gameWorld.moveGrab(px, py)
      } else if (gesture.type === 'pinchStart') {
        gameWorld.startGrab(px, py)
      } else if (gesture.type === 'pinchEnd') {
        gameWorld.endGrab()
      }
    }
  }

  onMounted(() => {
    loadLeaderboard()
    nextTick(() => {
      if (canvasRef.value) {
        canvasRef.value.width = window.innerWidth
        canvasRef.value.height = window.innerHeight

        gameWorld = new GameWorld(canvasRef.value)
        gameWorld.throwMultiplier = throwMultiplier.value
        gameWorld.onScore = onScore
        gameWorld.start()
        gameWorld.spawnBall()
        gameWorld.spawnHoop()

        // Don't auto-start game. Wait in Menu.
      }
    })

    window.addEventListener('resize', onResize)
  })

  onUnmounted(() => {
    if (timerInterval) clearInterval(timerInterval)
    if (gameWorld) {
      gameWorld.stop()
    }
    window.removeEventListener('resize', onResize)
  })

  const onResize = () => {
    if (canvasRef.value && gameWorld) {
      canvasRef.value.width = window.innerWidth
      canvasRef.value.height = window.innerHeight
      gameWorld.resize(window.innerWidth, window.innerHeight)
    }
  }

  defineExpose({
    handleGesture,
    handlePinchDistance,
    pinchThreshold,
    getGameWorld: () => gameWorld,
    highScore,
  })
</script>

<template>
  <div class="game-container">
    <canvas ref="canvasRef" class="game-canvas"></canvas>

    <!-- Visual Cursor for Debug/Feedback -->
    <div
      class="visual-cursor"
      :style="{
        left: cursorP.x + 'px',
        top: cursorP.y + 'px',
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
      }"
    ></div>

    <!-- Calibration -->
    <CalibrationOverlay
      v-if="gameState === 'CALIBRATING'"
      :current-pinch-distance="latestPinchDistance"
      @complete="onCalibrationComplete"
      @skip="onCalibrationSkip"
    />

    <!-- Components -->
    <StartMenu
      v-if="gameState === 'MENU'"
      :cursor-pos="cursorP"
      :top3-scores="top3Scores"
      @start-competitive="startGame('COMPETITIVE')"
      @start-practice="startGame('PRACTICE')"
      @show-leaderboard="showLeaderboard"
    />

    <LeaderboardOverlay
      v-if="gameState === 'LEADERBOARD'"
      :cursor-pos="cursorP"
      :leaderboard="leaderboard"
      @back="backToMenu"
    />

    <GameHud
      v-if="gameState === 'PLAYING'"
      :cursor-pos="cursorP"
      :score="score"
      :time-left="timeLeft"
      :is-infinite="isInfinite"
      @exit="backToMenu"
    />

    <GameOverOverlay
      v-if="gameState === 'GAME_OVER'"
      :cursor-pos="cursorP"
      :score="score"
      :game-mode="gameMode"
      @play-again="startGame('COMPETITIVE')"
      @menu="backToMenu"
    />
  </div>
</template>

<style scoped>
  .game-container {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }

  .game-canvas {
    display: block;
    width: 100%;
    height: 100%;
  }

  .visual-cursor {
    position: absolute;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid white;
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 9999;
    transition: background-color 0.2s;
  }
</style>
```
