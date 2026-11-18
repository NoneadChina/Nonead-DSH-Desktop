/**
 * Renders the NSIS wizard sidebar from `build/app-icon.png`.
 *
 * electron-builder otherwise falls back to its bundled NSIS metro graphic, so the installer shows
 * a stock picture instead of this product's logo. MUI_WELCOMEFINISHPAGE_BITMAP only accepts a BMP
 * and never scales it, which is why the artwork is baked here at the exact 164x314 size NSIS uses
 * (24-bit, bottom-up rows) instead of being handed to electron-builder as a PNG.
 *
 * Run `node scripts/build-installer-sidebar.mjs` after changing app-icon.png; the output is
 * committed because the packaging host must not need an image decoder.
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = fileURLToPath(new URL('..', import.meta.url))
const source = join(root, 'build', 'app-icon.png')
const destination = join(root, 'build', 'installer-sidebar.bmp')

const width = 164
const height = 314
// The left panel holds the logo with breathing room on every side; the rest stays page white.
const logoBox = 128
const margin = 0

const logo = await sharp(source).trim({ threshold: 1 }).resize(logoBox, logoBox, {
  fit: 'inside',
  background: { r: 0, g: 0, b: 0, alpha: 0 },
}).png().toBuffer()

const { data: logoRaw, info: logoInfo } = await sharp(logo).ensureAlpha().raw().toBuffer({ resolveWithObject: true })

const pixels = Buffer.alloc(width * height * 3, 0xff)
const offsetX = Math.round((width - logoInfo.width) / 2)
const offsetY = Math.round((height - logoInfo.height) / 2) - margin

for (let y = 0; y < logoInfo.height; y += 1) {
  const targetY = offsetY + y
  if (targetY < 0 || targetY >= height) continue
  for (let x = 0; x < logoInfo.width; x += 1) {
    const targetX = offsetX + x
    if (targetX < 0 || targetX >= width) continue
    const from = (y * logoInfo.width + x) * 4
    const alpha = logoRaw[from + 3] / 255
    if (alpha === 0) continue
    const to = (targetY * width + targetX) * 3
    for (let channel = 0; channel < 3; channel += 1) {
      const painted = logoRaw[from + channel]
      pixels[to + channel] = Math.round(painted * alpha + 0xff * (1 - alpha))
    }
  }
}

// 24-bit BMP: rows are stored bottom-up, padded to a 4-byte boundary (164*3 is already aligned).
const rowSize = Math.ceil((width * 3) / 4) * 4
const imageSize = rowSize * height
const header = Buffer.alloc(54)
header.write('BM', 0, 'ascii')
header.writeUInt32LE(54 + imageSize, 2)
header.writeUInt32LE(54, 10)
header.writeUInt32LE(40, 14)
header.writeInt32LE(width, 18)
header.writeInt32LE(height, 22)
header.writeUInt16LE(1, 26)
header.writeUInt16LE(24, 28)
header.writeUInt32LE(imageSize, 34)
header.writeInt32LE(2835, 38)
header.writeInt32LE(2835, 42)

const body = Buffer.alloc(imageSize)
for (let y = 0; y < height; y += 1) {
  const sourceRow = (height - 1 - y) * width * 3
  for (let x = 0; x < width; x += 1) {
    const from = sourceRow + x * 3
    const to = y * rowSize + x * 3
    body[to] = pixels[from + 2]
    body[to + 1] = pixels[from + 1]
    body[to + 2] = pixels[from]
  }
}

writeFileSync(destination, Buffer.concat([header, body]))
console.log(`Wrote ${destination} (${String(54 + imageSize)} bytes, ${String(width)}x${String(height)})`)
