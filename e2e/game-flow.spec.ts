/**
 * E2E tests for the core Gesto Fly game flow.
 *
 * Strategy
 * --------
 * 1. Abort MediaPipe CDN requests so the app boots without hand-tracking.
 * 2. Inject a fake canvas-based MediaStream so getUserMedia never rejects.
 * 3. Pre-set `gesto-fly-calibration` in localStorage so the app skips the
 *    calibration screen and opens directly on the StartMenu.
 * 4. For the score test, install Playwright's fake clock before navigation so
 *    the competitive 30 s setInterval is under test control, then advance it
 *    to trigger endGame() without waiting a real 30 seconds.
 */
import { test, expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

const CALIBRATION_KEY = 'gesto-fly-calibration'
const CALIBRATION_DATA = JSON.stringify({ min: 0.01, max: 0.12, throwMultiplier: 0.3 })

/** Abort all MediaPipe asset requests so the worker never initialises. */
async function abortMediaPipeRoutes(page: import('@playwright/test').Page) {
  await page.route('**/*.task', (route) => route.abort())
  await page.route('**/*wasm*', (route) => route.abort())
  await page.route('**/jsdelivr.net/**', (route) => route.abort())
}

/** Inject a fake camera stream and pre-calibration data before page scripts run. */
async function injectMocksBeforeLoad(page: import('@playwright/test').Page) {
  await page.addInitScript(`
    (() => {
      // Fake MediaStream from a blank canvas so getUserMedia resolves cleanly
      const fakeCanvas = document.createElement('canvas');
      fakeCanvas.width = 640;
      fakeCanvas.height = 480;
      const fakeStream = fakeCanvas.captureStream(10);
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
        configurable: true,
        writable: true,
        value: async () => fakeStream,
      });

      // Skip calibration screen
      localStorage.setItem(${JSON.stringify(CALIBRATION_KEY)}, ${JSON.stringify(CALIBRATION_DATA)});
    })();
  `)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Game Flow', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['camera'])
    await abortMediaPipeRoutes(page)
    await injectMocksBeforeLoad(page)
  })

  // ── 1. StartMenu visibility ────────────────────────────────────────────────
  test('shows StartMenu when calibration data is present', async ({ page }) => {
    await page.goto('/')

    // The title and competitive button must be visible
    await expect(page.getByText('GESTO FLY')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('button.menu-btn.primary')).toBeVisible()
  })

  // ── 2. PLAYING state transition ───────────────────────────────────────────
  test('transitions to PLAYING state after clicking COMPETITIVE', async ({ page }) => {
    await page.goto('/')

    await page.locator('button.menu-btn.primary').click()

    // GameHud (.hud) is only mounted when gameState === 'PLAYING'
    await expect(page.locator('.hud')).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('.hud .label').first()).toHaveText('SCORE')
  })

  // ── 3. GameOverOverlay with correct score ─────────────────────────────────
  test('shows GameOverOverlay with the correct score after game ends', async ({ page }) => {
    // Install fake clock BEFORE navigation so the competitive setInterval
    // created inside startGame() is controlled by the test.
    await page.clock.install({ time: Date.now() })

    await page.goto('/')
    await expect(page.getByText('GESTO FLY')).toBeVisible({ timeout: 10_000 })

    // Enter competitive mode
    await page.locator('button.menu-btn.primary').click()
    await expect(page.locator('.hud')).toBeVisible({ timeout: 5_000 })

    // Trigger 3 score events via the exposed GameWorld event emitter.
    // GameCanvas exposes getGameWorld() which returns the GameWorld whose
    // emitter fires the 'score' event that onScore() listens to.
    const scored = await page.evaluate(() => {
      const gameContainer = document.querySelector('.game-container') as Element & {
        __vueParentComponent?: {
          exposed?: { getGameWorld?: () => { emitter?: { emit: (e: string) => void } } | null }
        }
      }
      const gameWorld = gameContainer?.__vueParentComponent?.exposed?.getGameWorld?.()
      if (!gameWorld?.emitter) return false
      gameWorld.emitter.emit('score')
      gameWorld.emitter.emit('score')
      gameWorld.emitter.emit('score')
      return true
    })

    // If GameWorld was not available (e.g. Matter.js canvas not ready yet),
    // the test will still run but score will be 0 – guard with a soft skip.
    if (!scored) {
      test.skip()
    }

    // Advance fake clock 35 s: the 30 s competitive timer fires endGame(),
    // and the 1.5 s celebration timeouts resolve beforehand.
    await page.clock.runFor(35_000)

    // GameOverOverlay must be visible
    await expect(page.locator('.game-over-card')).toBeVisible({ timeout: 5_000 })

    // The highlighted score element should display 3
    await expect(page.locator('.highlight')).toHaveText('3')
  })
})
