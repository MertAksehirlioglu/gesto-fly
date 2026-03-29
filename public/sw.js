/**
 * Service Worker — MediaPipe WASM Cache
 *
 * Caches MediaPipe CDN assets (WASM, JS model files) using a cache-first
 * strategy so repeat visits skip the network entirely for these heavy files.
 *
 * Bump CACHE_VERSION to force a fresh cache (e.g. after a MediaPipe upgrade).
 */

const CACHE_VERSION = 'v1'
const CACHE_NAME = `gesto-fly-mediapipe-${CACHE_VERSION}`

/** URL prefixes that should be cached */
const CACHEABLE_ORIGINS = [
  'https://cdn.jsdelivr.net/npm/@mediapipe/',
  'https://storage.googleapis.com/mediapipe-',
]

function shouldCache(url) {
  return CACHEABLE_ORIGINS.some((prefix) => url.startsWith(prefix))
}

// ── Install ────────────────────────────────────────────────────────────────
self.addEventListener('install', () => {
  // Activate immediately; no pre-caching needed (cache on first fetch)
  self.skipWaiting()
})

// ── Activate ───────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith('gesto-fly-mediapipe-') && key !== CACHE_NAME,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

// ── Fetch (Cache-First for MediaPipe assets) ───────────────────────────────
self.addEventListener('fetch', (event) => {
  if (!shouldCache(event.request.url)) return // Let browser handle everything else

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request)
      if (cached) return cached

      const response = await fetch(event.request)
      if (response.ok) {
        // Clone because the body can only be consumed once
        cache.put(event.request, response.clone())
      }
      return response
    }),
  )
})
