/** Generate native tray bitmaps from the repository-owned brand SVGs. */

import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const buildRoot = join(packageRoot, 'build')

const BRAND_COLOR = '#22863A'
/**
 * Colour variants come from the brand plate source. macOS template images are drawn
 * from the alpha channel only, so a plate would render as a solid block there: the
 * template keeps its own plate-less silhouette source.
 */
const colorSourcePath = join(buildRoot, 'tray-icon.svg')
const templateSourcePath = join(buildRoot, 'tray-icon-template.svg')

const colorSource = await readFile(colorSourcePath, 'utf8')
const templateSource = await readFile(templateSourcePath, 'utf8')

for (const [path, source] of [[colorSourcePath, colorSource], [templateSourcePath, templateSource]]) {
  if (/<style\b/iu.test(source)) {
    throw new Error(`generate-tray-icons: ${path} must not carry a <style> block`)
  }
}
if (!colorSource.includes(`fill="${BRAND_COLOR}"`)) {
  throw new Error(`generate-tray-icons: ${colorSourcePath} must use the fixed brand color ${BRAND_COLOR}`)
}
if (templateSource.includes(BRAND_COLOR)) {
  throw new Error(`generate-tray-icons: ${templateSourcePath} must stay colour-independent`)
}

const variants = [
  ['tray-iconTemplate.png', templateSource, '#000000', 16],
  ['tray-iconTemplate@2x.png', templateSource, '#000000', 32],
  ['tray-icon-blue.png', colorSource, BRAND_COLOR, 16],
  ['tray-icon-blue@1.25x.png', colorSource, BRAND_COLOR, 20],
  ['tray-icon-blue@1.5x.png', colorSource, BRAND_COLOR, 24],
  ['tray-icon-blue@2x.png', colorSource, BRAND_COLOR, 32],
]

await Promise.all(variants.map(async ([filename, source, color, size]) => {
  const rendered = source.replaceAll(BRAND_COLOR, color)
  await sharp(Buffer.from(rendered))
    .resize({ width: size, height: size, fit: 'contain' })
    .png({ compressionLevel: 9 })
    .toFile(join(buildRoot, filename))
}))
