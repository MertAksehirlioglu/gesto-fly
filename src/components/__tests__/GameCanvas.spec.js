import { describe, it, expect, beforeAll, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import GameCanvas from '../GameCanvas.vue'

// Mock GameWorld to prevent Matter.js physics engine from starting in jsdom
vi.mock('../../game/GameWorld', () => {
  class GameWorld {
    constructor() {
      this.throwMultiplier = 1
      this.emitter = { on: vi.fn(), off: vi.fn(), emit: vi.fn() }
    }
    start() {}
    stop() {}
    spawnBall() {}
    spawnHoop() {}
    startGrab() {}
    moveGrab() {}
    endGrab() {}
    resize() {}
  }
  return { GameWorld }
})

const vuetify = createVuetify({ components, directives })

beforeAll(() => {
  // jsdom doesn't implement ResizeObserver — provide a constructable stub
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  // jsdom doesn't implement canvas getContext
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null)
})

describe('GameCanvas', () => {
  it('renders properly', () => {
    const wrapper = mount(GameCanvas, {
      props: { currentTeamName: 'Team A' },
      global: { plugins: [vuetify] },
    })
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('.game-container').exists()).toBe(true)
  })
})
