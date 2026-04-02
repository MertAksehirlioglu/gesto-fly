/**
 * mediapipeWorker.ts
 *
 * Dedicated Web Worker for MediaPipe HandLandmarker inference.
 * Running inference here keeps the main thread free for Matter.js physics
 * and canvas rendering, eliminating jank on mid-range mobile hardware.
 *
 * Protocol:
 *   Main → Worker:
 *     { type: 'INIT',   wasmUrl: string, modelBuffer: ArrayBuffer }
 *     { type: 'DETECT', bitmap: ImageBitmap, timestamp: number }
 *     { type: 'TERMINATE' }
 *
 *   Worker → Main:
 *     { type: 'READY' }
 *     { type: 'ERROR',   message: string }
 *     { type: 'RESULTS', landmarks: SerializedLandmark[][] }
 */

import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision'

export interface SerializedLandmark {
  x: number
  y: number
  z: number
  visibility?: number
}

let landmarker: HandLandmarker | null = null

self.addEventListener('message', async (e: MessageEvent) => {
  const { type, ...data } = e.data as {
    type: string
    wasmUrl?: string
    modelBuffer?: ArrayBuffer
    bitmap?: ImageBitmap | VideoFrame
    timestamp?: number
  }

  switch (type) {
    case 'INIT': {
      try {
        const vision = await FilesetResolver.forVisionTasks(data.wasmUrl!)
        const modelAssetBuffer = new Uint8Array(data.modelBuffer!)

        // Try GPU delegate first, fall back to CPU
        try {
          landmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetBuffer, delegate: 'GPU' },
            runningMode: 'VIDEO',
            numHands: 1,
          })
        } catch {
          console.warn('[MediaPipe Worker] GPU delegate unavailable, using CPU')
          landmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetBuffer, delegate: 'CPU' },
            runningMode: 'VIDEO',
            numHands: 1,
          })
        }

        self.postMessage({ type: 'READY' })
      } catch (err) {
        self.postMessage({ type: 'ERROR', message: String(err) })
      }
      break
    }

    case 'DETECT': {
      if (!landmarker || !data.bitmap) {
        data.bitmap?.close()
        return
      }

      const result: HandLandmarkerResult = landmarker.detectForVideo(
        data.bitmap,
        data.timestamp!,
      )
      // Release the bitmap memory immediately after inference
      data.bitmap.close()

      // Serialize landmarks as plain objects (structured-clone compatible)
      const landmarks: SerializedLandmark[][] = result.landmarks.map((hand) =>
        hand.map(({ x, y, z, visibility }) => ({ x, y, z, visibility })),
      )

      self.postMessage({ type: 'RESULTS', landmarks })
      break
    }

    case 'TERMINATE': {
      landmarker?.close()
      landmarker = null
      break
    }
  }
})
