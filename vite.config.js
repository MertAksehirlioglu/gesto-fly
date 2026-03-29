import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

import vuetify from 'vite-plugin-vuetify'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vuetify({ autoImport: true })],
  server: {
    headers: {
      'Permissions-Policy': 'camera=(self)',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    server: {
      deps: {
        inline: ['vuetify'],
      },
    },
  },
})
