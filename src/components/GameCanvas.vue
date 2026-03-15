<script setup lang="ts">
  import { onMounted, onUnmounted, ref, nextTick, computed } from 'vue'
  import { GameWorld } from '../game/GameWorld'
  import StartMenu from './overlays/StartMenu.vue'
  import GameHud from './overlays/GameHud.vue'
  import GameOverOverlay from './overlays/GameOverOverlay.vue'
  import LeaderboardOverlay from './overlays/LeaderboardOverlay.vue'
  import CalibrationOverlay from './overlays/CalibrationOverlay.vue'
  import { useCalibration } from '../composables/useCalibration'
  import { useGameAudio } from '../composables/useGameAudio'

  const props = defineProps<{
    currentTeamName: string
  }>()

  // --- Audio ---
  const { playSwish, playRimClank, playCrowdCheer, closeAudio } = useGameAudio()

  // --- Calibration ---
  const { isCalibrated, pinchThreshold, throwMultiplier, finalize, reset } =
    useCalibration()
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

  const onRecalibrate = () => {
    reset()
    gameState.value = 'CALIBRATING'
  }

  // --- State ---
  const canvasRef = ref<HTMLCanvasElement | null>(null)
  let gameWorld: GameWorld | null = null

  // Game States
  type GameState =
    | 'CALIBRATING'
    | 'MENU'
    | 'PLAYING'
    | 'GAME_OVER'
    | 'LEADERBOARD'
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

  const isValidScoreEntry = (entry: unknown): entry is ScoreEntry => {
    if (!entry || typeof entry !== 'object') return false
    const e = entry as Record<string, unknown>
    return (
      typeof e.score === 'number' &&
      Number.isFinite(e.score) &&
      e.score >= 0 &&
      typeof e.team === 'string' &&
      e.team.length <= 100 &&
      typeof e.date === 'string'
    )
  }

  const loadLeaderboard = () => {
    const saved = localStorage.getItem(STORAGE_KEY_LEADERBOARD)
    if (saved) {
      try {
        const parsed: unknown = JSON.parse(saved)
        if (!Array.isArray(parsed)) {
          leaderboard.value = []
          return
        }
        leaderboard.value = parsed.filter(isValidScoreEntry)
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

  // [Feature] Score Celebration Animation
  const celebrating = ref(false)

  const onScore = () => {
    if (gameState.value === 'PLAYING') {
      score.value++
      celebrating.value = true
      playCrowdCheer()

      // Auto-dismiss after 1.5s, then reset ball
      setTimeout(() => {
        celebrating.value = false
        if (gameWorld) {
          gameWorld.completeScore()
        }
      }, 1500)
    } else {
      // Not playing — still complete the score reset
      if (gameWorld) {
        gameWorld.completeScore()
      }
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
        playSwish()
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
        gameWorld.onRimHit = playRimClank
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
    closeAudio()
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
      @recalibrate="onRecalibrate"
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
      :celebrating="celebrating"
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

    <!-- [Feature] Score Celebration Animation Overlay -->
    <Transition name="celebration">
      <div v-if="celebrating" class="celebration-overlay">
        <!-- Confetti emoji particles -->
        <span class="confetti c1">🎉</span>
        <span class="confetti c2">🏀</span>
        <span class="confetti c3">🎉</span>
        <span class="confetti c4">🏀</span>
        <span class="confetti c5">🎉</span>
        <span class="confetti c6">🏀</span>
        <div class="celebration-text">SCORE!</div>
      </div>
    </Transition>
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

  /* ── [Feature] Score Celebration Overlay ── */
  .celebration-overlay {
    position: absolute;
    inset: 0;
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.45);
    pointer-events: none;
    overflow: hidden;
  }

  /* Vue Transition */
  .celebration-enter-active {
    animation: celebFadeIn 0.2s ease-out forwards;
  }
  .celebration-leave-active {
    animation: celebFadeOut 0.3s ease-in forwards;
  }

  @keyframes celebFadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  @keyframes celebFadeOut {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }

  /* Score text with bounce */
  .celebration-text {
    font-size: 5rem;
    font-weight: 900;
    color: #fff;
    text-shadow:
      0 4px 20px rgba(0, 0, 0, 0.8),
      0 0 40px rgba(255, 200, 0, 0.8);
    animation: scoreBounce 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
    letter-spacing: 4px;
  }

  @keyframes scoreBounce {
    0% {
      transform: scale(0.3);
      opacity: 0;
    }
    50% {
      transform: scale(1.25);
      opacity: 1;
    }
    75% {
      transform: scale(0.9);
    }
    100% {
      transform: scale(1);
    }
  }

  /* Confetti emojis floating up */
  .confetti {
    position: absolute;
    font-size: 2.5rem;
    animation: floatUp 1.4s ease-out forwards;
    opacity: 0;
  }

  @keyframes floatUp {
    0% {
      transform: translateY(60px) scale(0.5);
      opacity: 0;
    }
    20% {
      opacity: 1;
    }
    100% {
      transform: translateY(-160px) scale(1.2) rotate(30deg);
      opacity: 0;
    }
  }

  .c1 {
    left: 12%;
    bottom: 30%;
    animation-delay: 0s;
    animation-duration: 1.2s;
  }
  .c2 {
    left: 28%;
    bottom: 25%;
    animation-delay: 0.1s;
    animation-duration: 1.4s;
  }
  .c3 {
    left: 48%;
    bottom: 20%;
    animation-delay: 0.05s;
    animation-duration: 1.3s;
  }
  .c4 {
    right: 28%;
    bottom: 25%;
    animation-delay: 0.15s;
    animation-duration: 1.5s;
  }
  .c5 {
    right: 12%;
    bottom: 30%;
    animation-delay: 0.08s;
    animation-duration: 1.2s;
  }
  .c6 {
    left: 65%;
    bottom: 22%;
    animation-delay: 0.2s;
    animation-duration: 1.35s;
  }
</style>
