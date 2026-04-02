/// <reference types="vite/client" />

// [Performance] MediaStreamTrackProcessor — WICG proposal, not yet in lib.dom.d.ts
interface MediaStreamTrackProcessorInit {
  track: MediaStreamTrack
  maxBufferSize?: number
}
declare class MediaStreamTrackProcessor {
  readonly readable: ReadableStream<VideoFrame>
  constructor(init: MediaStreamTrackProcessorInit)
}

// VideoFrame — part of WebCodecs API, not in lib.dom.d.ts for ES2022 target
declare class VideoFrame {
  readonly timestamp: number | null
  close(): void
}

// [Feature] PWA Install Prompt — browser-native type not yet in lib.dom.d.ts for all TS versions
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-object-type
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module 'vuetify'
declare module 'vuetify/components'
declare module 'vuetify/directives'
declare module 'vuetify/iconsets/mdi'
