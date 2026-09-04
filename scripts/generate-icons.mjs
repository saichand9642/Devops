/**
 * Generates the PWA icon set as real PNG files with no image dependencies.
 *
 * Everything is drawn procedurally (rounded square + Kubernetes-style seven
 * spoke helm wheel) and encoded with a minimal PNG writer built on zlib, so the
 * icons in public/icons are fully reproducible with:
 *
 *   npm run icons
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')

/* ---------------------------------------------------------------- PNG writer */

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeAndData = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData), 0)
  return Buffer.concat([length, typeAndData, crc])
}

/** Encodes an RGBA pixel buffer (width * height * 4) as an 8-bit RGBA PNG. */
function encodePng(width, height, rgba) {
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0 // filter type 0 (none)
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type: RGBA
  ihdr[10] = 0 // deflate
  ihdr[11] = 0 // adaptive filtering
  ihdr[12] = 0 // no interlace
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/* ------------------------------------------------------------------- drawing */

const mix = (a, b, t) => a + (b - a) * t
const clamp01 = (n) => Math.min(1, Math.max(0, n))

/** Anti-aliased coverage for a signed distance: inside < 0, outside > 0. */
const coverage = (distance) => clamp01(0.5 - distance)

function roundedRectDistance(x, y, w, h, radius) {
  const dx = Math.abs(x - w / 2) - (w / 2 - radius)
  const dy = Math.abs(y - h / 2) - (h / 2 - radius)
  const ax = Math.max(dx, 0)
  const ay = Math.max(dy, 0)
  return Math.min(Math.max(dx, dy), 0) + Math.sqrt(ax * ax + ay * ay) - radius
}

/** Distance to a line segment, used for the wheel spokes. */
function segmentDistance(px, py, ax, ay, bx, by) {
  const vx = bx - ax
  const vy = by - ay
  const wx = px - ax
  const wy = py - ay
  const t = clamp01((wx * vx + wy * vy) / (vx * vx + vy * vy))
  const cx = ax + vx * t
  const cy = ay + vy * t
  return Math.hypot(px - cx, py - cy)
}

function over(dst, i, r, g, b, alpha) {
  if (alpha <= 0) return
  const a = Math.min(1, alpha)
  dst[i] = Math.round(mix(dst[i], r, a))
  dst[i + 1] = Math.round(mix(dst[i + 1], g, a))
  dst[i + 2] = Math.round(mix(dst[i + 2], b, a))
  dst[i + 3] = Math.max(dst[i + 3], Math.round(255 * a))
}

/**
 * @param {number} size    output width/height in pixels
 * @param {boolean} maskable draws the artwork inside the safe zone and fills the
 *                           whole canvas, as required for maskable icons
 */
function drawIcon(size, maskable = false) {
  const px = Buffer.alloc(size * size * 4)
  const s = size
  const radius = maskable ? 0 : s * 0.22
  // Maskable icons must survive a circular mask: keep art within the middle 80%.
  const artScale = maskable ? 0.62 : 0.78
  const cx = s / 2
  const cy = s / 2
  const ringOuter = (s * artScale) / 2
  const ringWidth = Math.max(1.5, s * 0.055)
  const hubRadius = ringOuter * 0.3
  const spokeWidth = Math.max(1.2, s * 0.045)

  for (let y = 0; y < s; y += 1) {
    for (let x = 0; x < s; x += 1) {
      const i = (y * s + x) * 4
      const fx = x + 0.5
      const fy = y + 0.5

      // Background: vertical navy -> indigo gradient inside a rounded square.
      const t = fy / s
      const bgR = Math.round(mix(11, 30, t))
      const bgG = Math.round(mix(18, 41, t))
      const bgB = Math.round(mix(32, 82, t))
      const bgCoverage = maskable ? 1 : coverage(roundedRectDistance(fx, fy, s, s, radius))
      over(px, i, bgR, bgG, bgB, bgCoverage)
      if (bgCoverage <= 0) continue

      const dist = Math.hypot(fx - cx, fy - cy)

      // Ring
      const ringAlpha = coverage(Math.abs(dist - ringOuter + ringWidth / 2) - ringWidth / 2)
      // Hub
      const hubAlpha = coverage(dist - hubRadius)
      // Seven spokes, matching the seven-spoked helm of the Kubernetes logo.
      let spokeAlpha = 0
      for (let k = 0; k < 7; k += 1) {
        const angle = (Math.PI * 2 * k) / 7 - Math.PI / 2
        const ax = cx + Math.cos(angle) * hubRadius * 0.6
        const ay = cy + Math.sin(angle) * hubRadius * 0.6
        const bx = cx + Math.cos(angle) * (ringOuter - ringWidth * 0.5)
        const by = cy + Math.sin(angle) * (ringOuter - ringWidth * 0.5)
        spokeAlpha = Math.max(
          spokeAlpha,
          coverage(segmentDistance(fx, fy, ax, ay, bx, by) - spokeWidth / 2),
        )
      }

      const art = Math.max(ringAlpha, hubAlpha, spokeAlpha) * bgCoverage
      // Light blue artwork keeps contrast high on the dark background.
      over(px, i, 125, 211, 252, art)
    }
  }
  return encodePng(s, s, px)
}

/* -------------------------------------------------------------------- output */

mkdirSync(OUT_DIR, { recursive: true })

const targets = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['maskable-512.png', 512, true],
  ['apple-touch-icon-180.png', 180, false],
]

for (const [name, size, maskable] of targets) {
  const png = drawIcon(size, maskable)
  writeFileSync(resolve(OUT_DIR, name), png)
  console.log(`wrote icons/${name} (${size}x${size}, ${png.length} bytes)`)
}
