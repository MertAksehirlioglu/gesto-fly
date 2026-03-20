/**
 * Fetches a resource and verifies its SHA-384 integrity hash via the Web Crypto API.
 *
 * This mirrors the browser SRI mechanism (W3C Subresource Integrity spec) for
 * use with fetch()-based asset loads that don't go through <script>/<link> tags
 * (e.g. MediaPipe model files fetched at runtime as ArrayBuffers).
 *
 * Usage:
 *   const buffer = await verifyAssetIntegrity(url, 'sha384-<base64hash>')
 *   // Use buffer as Uint8Array: new Uint8Array(buffer)
 *
 * Throws if the download fails or the digest does not match the expected hash.
 */
export async function verifyAssetIntegrity(
  url: string,
  expectedHash: string,
): Promise<ArrayBuffer> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Asset fetch failed for ${url}: HTTP ${response.status}`)
  }

  const buffer = await response.arrayBuffer()

  const hashBuffer = await crypto.subtle.digest('SHA-384', buffer)
  const hashBytes = new Uint8Array(hashBuffer)
  // btoa requires a string of char codes, not a Uint8Array directly
  const hashBase64 = btoa(
    Array.from(hashBytes)
      .map((b) => String.fromCharCode(b))
      .join(''),
  )

  const expected = expectedHash.startsWith('sha384-')
    ? expectedHash.slice(7)
    : expectedHash

  if (hashBase64 !== expected) {
    throw new Error(
      `Integrity check failed for ${url}\n` +
        `Expected: sha384-${expected}\n` +
        `Got:      sha384-${hashBase64}\n` +
        'This may indicate a CDN compromise or an unexpected version change.',
    )
  }

  return buffer
}
