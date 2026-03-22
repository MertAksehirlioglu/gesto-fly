<script setup lang="ts">
  import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
  import GameCanvas from './components/GameCanvas.vue'
  import CameraInput from './components/CameraInput.vue'
  import TeamSelector from './components/TeamSelector.vue'
  import MobileWarning from './components/overlays/MobileWarning.vue'
  import { useScreenCoordinates } from './composables/useScreenCoordinates'
  import { useCalibration } from './composables/useCalibration'

  const gameCanvasRef = ref<InstanceType<typeof GameCanvas> | null>(null)
  const currentTeam = ref('fenerbahce')
  const handDetected = ref(false)

  // Calibration (singleton — shared with GameCanvas)
  const { pinchThreshold } = useCalibration()

  const onPinchDistance = (distance: number) => {
    gameCanvasRef.value?.handlePinchDistance(distance)
  }

  const onPinchStateChange = (isPinching: boolean) => {
    gameCanvasRef.value?.handlePinchStateChange(isPinching)
  }

  // Use Composable for consistent coord math
  const { transform } = useScreenCoordinates(4 / 3) // 4:3 is standard webcam ratio

  const teamColors: Record<string, string> = {
    fenerbahce:
      'linear-gradient(135deg, rgba(255, 237, 0, 0.5) 0%, rgba(0, 65, 127, 0.5) 100%)',
    anadoluefes:
      'linear-gradient(135deg, rgba(33, 53, 87, 0.5) 0%, rgba(255, 255, 255, 0.5) 100%)',
    realmadrid:
      'linear-gradient(135deg, rgba(255, 255, 255, 0.5) 0%, rgba(254, 190, 16, 0.5) 100%)',
    panathinaikos:
      'linear-gradient(135deg, rgba(0, 120, 65, 0.5) 0%, rgba(255, 255, 255, 0.5) 100%)',
    olympiacos:
      'linear-gradient(135deg, rgba(208, 6, 31, 0.5) 0%, rgba(255, 255, 255, 0.5) 100%)',
    partizan:
      'linear-gradient(135deg, rgba(0, 0, 0, 0.5) 0%, rgba(255, 255, 255, 0.5) 100%)',
  }

  const stadiumStyle = computed(() => ({
    background: teamColors[currentTeam.value] || 'transparent',
  }))

  const groundStyle = computed(() => {
    const colors: Record<string, string> = {
      fenerbahce: '#00417F',
      anadoluefes: '#213557',
      realmadrid: '#FEBE10',
      panathinaikos: '#007841',
      olympiacos: '#D0061F',
      partizan: '#000000',
    }
    return {
      background: colors[currentTeam.value] || '#333',
    }
  })

  // Basic cursor tracking logic for UI overlay
  const cursorPos = ref({ x: 0, y: 0 })

  const onGesture = (gesture: { type: string; x: number; y: number }) => {
    // 1. Transform coordinates (Normalized -> Pixel)
    const { x: pixelX, y: pixelY } = transform(gesture.x, gesture.y)

    // 2. Update UI Cursor position
    // We update it on every gesture type to keep it synced even during pinching
    cursorPos.value.x = pixelX
    cursorPos.value.y = pixelY

    // 3. Pass Gesture (with Pixel Coordinates) to Game Engine
    if (gameCanvasRef.value) {
      gameCanvasRef.value.handleGesture({
        ...gesture,
        x: pixelX,
        y: pixelY,
      })
    }
  }

  const updateGameColors = () => {
    const canvas = gameCanvasRef.value
    // Access gameWorld safely
    if (canvas && canvas.getGameWorld) {
      const world = canvas.getGameWorld()
      if (world && world.activeHoop) {
        const netColors: Record<string, string> = {
          fenerbahce: '#FFED00',
          anadoluefes: '#FFFFFF', // White Net
          realmadrid: '#FEBE10',
          panathinaikos: '#007841',
          olympiacos: '#D0061F',
          partizan: '#000000',
        }
        world.activeHoop.setNetColor(netColors[currentTeam.value] || '#FFF')
      }
    }
  }

  const onTeamSelect = (teamId: string) => {
    currentTeam.value = teamId
    updateGameColors()
  }

  const currentTeamName = computed(() => {
    const names: Record<string, string> = {
      fenerbahce: 'Fenerbahçe',
      anadoluefes: 'Anadolu Efes',
      realmadrid: 'Real Madrid',
      panathinaikos: 'Panathinaikos',
      olympiacos: 'Olympiacos',
      partizan: 'Partizan',
    }
    return names[currentTeam.value] || currentTeam.value
  })

  // [Feature] PWA Install Prompt
  // Capture the browser's beforeinstallprompt event so we can surface it on demand.
  let deferredInstallPrompt: BeforeInstallPromptEvent | null = null
  const showInstallBanner = ref(false)

  const handleBeforeInstallPrompt = (e: Event) => {
    e.preventDefault()
    deferredInstallPrompt = e as BeforeInstallPromptEvent
    showInstallBanner.value = true
  }

  const installApp = async () => {
    if (!deferredInstallPrompt) return
    await deferredInstallPrompt.prompt()
    const { outcome } = await deferredInstallPrompt.userChoice
    if (outcome === 'accepted') {
      showInstallBanner.value = false
      deferredInstallPrompt = null
    }
  }

  const dismissInstallBanner = () => {
    showInstallBanner.value = false
  }

  onMounted(() => {
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    // Hide banner if the app is already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      showInstallBanner.value = false
    }
  })

  onBeforeUnmount(() => {
    window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  })

  // watch for initial load — use { flush: 'post' } so the child's onMounted
  // (which sets up gameWorld) has run before we try to apply colours
  watch(
    () => gameCanvasRef.value,
    (newVal) => {
      if (newVal) {
        // nextTick ensures GameCanvas onMounted + inner nextTick have completed
        void nextTick().then(() => updateGameColors())
      }
    },
    { immediate: true, flush: 'post' },
  )
</script>

<template>
  <v-app>
    <v-main class="d-flex w-100 h-100 pa-0">
      <MobileWarning :cursor-pos="cursorPos" />
      <!-- Camera Input (Background Layer) -->
      <div class="camera-layer">
        <CameraInput
          :pinch-threshold="pinchThreshold"
          @gesture="onGesture"
          @pinch-distance="onPinchDistance"
          @pinch-state-change="onPinchStateChange"
          @hand-detected="(v) => (handDetected = v)"
        />
      </div>

      <!-- Stadium Overlay (Target Layer) -->
      <div class="stadium-layer" :style="stadiumStyle"></div>

      <!-- Ground Overlay (Team Colors) -->
      <div class="ground-layer" :style="groundStyle"></div>

      <!-- UI Overlays (Top) -->
      <TeamSelector
        :cursor-x="cursorPos.x"
        :cursor-y="cursorPos.y"
        @select="onTeamSelect"
      />

      <!-- Game Overlay (Physics) -->
      <GameCanvas
        ref="gameCanvasRef"
        :current-team-name="currentTeamName"
        :hand-detected="handDetected"
      />

      <!-- [Feature] PWA Install Banner -->
      <div v-if="showInstallBanner" class="install-banner">
        <span class="install-banner-text">Add <strong>Gesto Fly</strong> to your home screen for fullscreen play!</span>
        <div class="install-banner-actions">
          <button class="install-btn install-btn-primary" @click="installApp">Install</button>
          <button class="install-btn install-btn-dismiss" @click="dismissInstallBanner">✕</button>
        </div>
      </div>
    </v-main>
  </v-app>
</template>

<style scoped>
  .install-banner {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 9999;
    background: rgba(20, 20, 40, 0.95);
    backdrop-filter: blur(8px);
    border-top: 1px solid rgba(231, 76, 60, 0.5);
    padding: 12px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    color: white;
    font-size: 0.9rem;
  }

  .install-banner-text {
    flex: 1;
  }

  .install-banner-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  .install-btn {
    border: none;
    border-radius: 8px;
    padding: 8px 16px;
    font-weight: bold;
    cursor: pointer;
    font-size: 0.85rem;
  }

  .install-btn-primary {
    background: #e74c3c;
    color: white;
  }

  .install-btn-dismiss {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.6);
    padding: 8px 10px;
  }

  .camera-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
  }

  .stadium-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
    pointer-events: none;
    transition: background 0.5s ease;
  }

  .ground-layer {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 150px; /* Matches physics floor logic */
    z-index: 2; /* Between stadium and UI? */
    opacity: 0.8;
    box-shadow: 0 -5px 20px rgba(0, 0, 0, 0.5);
    transition: background 0.5s ease;
  }
</style>
