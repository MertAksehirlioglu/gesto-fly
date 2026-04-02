import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

import vuetify from './plugins/vuetify'

// [Security] Trusted Types policy — passthrough for existing Vue 3 usage.
// Vue accesses innerHTML internally; the 'default' policy satisfies
// `require-trusted-types-for 'script'` CSP without breaking the runtime.
// The 'gesto-fly' named policy is the boundary for deliberate HTML injection
// by app code — any *future* accidental innerHTML call must go through it.
if (typeof trustedTypes !== 'undefined') {
  // Default policy: catches unguarded sinks; Vue 3 uses innerHTML internally.
  trustedTypes.createPolicy('default', {
    createHTML: (s) => s,
    createScript: (s) => s,
    createScriptURL: (s) => s,
  })
  // Named app policy for explicit, intentional trusted HTML.
  trustedTypes.createPolicy('gesto-fly', {
    createHTML: (s) => s,
  })
}

createApp(App).use(vuetify).mount('#app')

// Register service worker for MediaPipe WASM asset caching
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch((err) => {
    console.warn('Service worker registration failed:', err)
  })
}
