import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

import vuetify from './plugins/vuetify'

createApp(App).use(vuetify).mount('#app')

// Register service worker for MediaPipe WASM asset caching
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch((err) => {
    console.warn('Service worker registration failed:', err)
  })
}
