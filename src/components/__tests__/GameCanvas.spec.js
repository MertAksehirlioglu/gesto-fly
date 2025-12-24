import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import GameCanvas from '../GameCanvas.vue'

describe('GameCanvas', () => {
  it('renders properly', () => {
    const wrapper = mount(GameCanvas)
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('.game-container').exists()).toBe(true)
  })
})
