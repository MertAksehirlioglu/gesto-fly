<script setup lang="ts">
  import { ref, watch, computed, onUnmounted } from 'vue'

  const props = defineProps<{
    currentPinchDistance: number
  }>()

  const emit = defineEmits<{
    (e: 'complete', payload: { min: number; max: number }): void
    (e: 'skip'): void
  }>()

  type Step = 'open' | 'pinch' | 'done'
  const step = ref<Step>('open')
  const countdown = ref(2)
  const recordedMax = ref(0)
  const recordedMin = ref(0.12)

  let intervalId: ReturnType<typeof setInterval> | null = null
  let sampledMax = 0
  let sampledMin = 0.12

  const stepTitle = computed(() => {
    if (step.value === 'open') return 'Step 1: Open Your Hand'
    if (step.value === 'pinch') return 'Step 2: Pinch Your Fingers'
    return '✅ Calibration Complete!'
  })

  const stepInstruction = computed(() => {
    if (step.value === 'open')
      return 'Hold your hand open in front of the camera with your palm facing it.'
    if (step.value === 'pinch')
      return 'Now pinch your index finger and thumb together as tightly as you can.'
    return `Your pinch sensitivity has been calibrated. You are ready to play!`
  })

  const pinchBarPercent = computed(() =>
    Math.min((props.currentPinchDistance / 0.12) * 100, 100),
  )

  const startStep = (s: Step) => {
    step.value = s
    countdown.value = 2
    sampledMax = 0
    sampledMin = 0.12

    if (intervalId) clearInterval(intervalId)

    intervalId = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0) {
        clearInterval(intervalId!)
        intervalId = null
        if (s === 'open') {
          recordedMax.value = sampledMax
          startStep('pinch')
        } else if (s === 'pinch') {
          recordedMin.value = sampledMin
          step.value = 'done'
        }
      }
    }, 1000)
  }

  // Sample pinch distance during active steps
  watch(
    () => props.currentPinchDistance,
    (d) => {
      if (step.value === 'open') {
        if (d > sampledMax) sampledMax = d
      } else if (step.value === 'pinch') {
        if (d < sampledMin) sampledMin = d
      }
    },
  )

  const onStartPlaying = () => {
    emit('complete', { min: recordedMin.value, max: recordedMax.value })
  }

  const onSkip = () => {
    emit('skip')
  }

  // Start on mount
  startStep('open')

  onUnmounted(() => {
    if (intervalId) clearInterval(intervalId)
  })
</script>

<template>
  <div class="calibration-overlay">
    <!-- Skip button -->
    <v-btn
      class="skip-btn"
      variant="text"
      size="small"
      color="grey"
      @click="onSkip"
    >
      Skip
    </v-btn>

    <v-card class="calibration-card" rounded="xl" color="rgba(10,10,20,0.92)">
      <v-card-text class="text-center pa-8">
        <!-- Step indicator -->
        <div class="step-indicator mb-4">
          <v-chip
            v-for="(s, i) in ['open', 'pinch', 'done']"
            :key="s"
            :color="step === s ? 'orange' : step === 'done' || (step === 'pinch' && i === 0) ? 'grey' : 'grey-darken-3'"
            class="mx-1"
            size="small"
          >
            {{ i + 1 }}
          </v-chip>
        </div>

        <!-- Title -->
        <h2 class="text-h5 font-weight-bold text-white mb-2">
          {{ stepTitle }}
        </h2>
        <p class="text-body-2 text-grey-lighten-1 mb-6">
          {{ stepInstruction }}
        </p>

        <!-- Live pinch bar (shown during calibration steps) -->
        <template v-if="step !== 'done'">
          <div class="mb-2">
            <span class="text-caption text-grey">Live pinch distance</span>
          </div>
          <v-progress-linear
            :model-value="pinchBarPercent"
            color="orange"
            bg-color="grey-darken-3"
            rounded
            height="12"
            class="mb-6"
          />

          <!-- Countdown -->
          <div class="countdown-ring mb-4">
            <span class="text-h3 font-weight-black text-orange">
              {{ countdown }}
            </span>
          </div>

          <p class="text-caption text-grey">Hold steady…</p>
        </template>

        <!-- Done state -->
        <template v-else>
          <div class="mb-6">
            <v-chip color="orange" variant="tonal" size="large">
              Threshold: {{ (recordedMin + (recordedMax - recordedMin) * 0.3).toFixed(4) }}
            </v-chip>
          </div>
          <v-btn
            color="orange"
            size="large"
            rounded="xl"
            class="px-8"
            @click="onStartPlaying"
          >
            Start Playing 🏀
          </v-btn>
        </template>
      </v-card-text>
    </v-card>
  </div>
</template>

<style scoped>
  .calibration-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9000;
  }

  .calibration-card {
    width: min(480px, 90vw);
    border: 1px solid rgba(255, 165, 0, 0.2);
  }

  .skip-btn {
    position: absolute;
    top: 16px;
    right: 16px;
  }

  .countdown-ring {
    width: 80px;
    height: 80px;
    border: 3px solid rgba(255, 165, 0, 0.4);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto;
  }
</style>
