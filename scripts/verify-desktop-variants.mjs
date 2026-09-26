import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const stableRoot = join(root, 'dsh-plugin-desktop', 'src')
const betaRoot = join(root, 'dsh-plugin-desktop-beta', 'src')
// Both editions share behavior. Only release identity and launcher wording differ.
const betaOnlyPaths = new Set([])
const allowedDifferences = new Set(['product-identity.ts'])
const normalizeIdentity = source => source.toString().replaceAll('dsh-plugin-desktop-beta', 'dsh-plugin-desktop').replaceAll('DSH Desktop Beta', 'DSH Desktop')

function files(directory, base = directory) {
  const result = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) result.push(...files(path, base))
    else if (entry.isFile()) result.push(relative(base, path).split(sep).join('/'))
  }
  return result
}

const sharedPaths = new Set([...files(stableRoot), ...files(betaRoot), ...betaOnlyPaths])
const differences = []
for (const path of [...sharedPaths].sort()) {
  if (allowedDifferences.has(path)) continue
  let stable
  let beta
  try { stable = readFileSync(join(stableRoot, path)) } catch { stable = undefined }
  try { beta = readFileSync(join(betaRoot, path)) } catch { beta = undefined }
  if (betaOnlyPaths.has(path)) {
    if (stable !== undefined || beta === undefined) differences.push(`${path} (must exist only in beta)`)
    continue
  }
  if (stable === undefined || beta === undefined || normalizeIdentity(stable) !== normalizeIdentity(beta)) differences.push(path)
}

if (differences.length > 0) {
  throw new Error(`Desktop variant source drift is not declared:\n${differences.map(path => `- src/${path}`).join('\n')}`)
}

// `src/` was the only synchronized surface, so a packaging fix applied to one
// edition could silently never reach the other. Extend the same normalization to
// the packaging scripts, builder resources and the manifests, and declare each
// remaining difference explicitly so a new one fails instead of going unnoticed.
const PACKAGING_SURFACES = ['scripts', 'build']
/**
 * Packaged surfaces that legitimately differ per edition, because they name the
 * product or carry edition-specific artwork, plus the stable-only Windows NSIS
 * A/B tooling that only the stable release pipeline uses.
 */
const declaredPackagingDifferences = new Set([
  'scripts/probe-windows-installer-quit.ps1',
  'scripts/verify-loader-boot.mjs',
  'scripts/verify-profile-boot.mjs',
  'scripts/verify-win-installer.ts',
  'scripts/verify-win-portable.ts',
  'build/app-icon.ico',
])
const stableOnlyPackaging = new Set([
  'scripts/build-windows-nsis-ab.ts',
  'scripts/generate-windows-app-icon.mjs',
  'scripts/inspect-windows-installed-app.ts',
  'scripts/probe-windows-packaged-runtime.ts',
  'scripts/run-windows-nsis-ab.ps1',
  'scripts/verify-nsis-ab-prepackaged.ts',
  'scripts/windows-nsis-ab.ts',
])

const packagingDifferences = []
for (const surface of PACKAGING_SURFACES) {
  const stableFiles = new Set(files(join(root, 'dsh-plugin-desktop', surface)))
  const betaFiles = new Set(files(join(root, 'dsh-plugin-desktop-beta', surface)))
  for (const path of [...new Set([...stableFiles, ...betaFiles])].sort()) {
    const key = `${surface}/${path}`
    if (declaredPackagingDifferences.has(key)) continue
    if (stableOnlyPackaging.has(key)) {
      if (!stableFiles.has(path) || betaFiles.has(path)) packagingDifferences.push(`${key} (must exist only in the stable edition)`)
      continue
    }
    if (!stableFiles.has(path) || !betaFiles.has(path)) {
      packagingDifferences.push(`${key} (must exist in both editions)`)
      continue
    }
    const stable = readFileSync(join(root, 'dsh-plugin-desktop', surface, path))
    const beta = readFileSync(join(root, 'dsh-plugin-desktop-beta', surface, path))
    if (normalizeIdentity(stable) !== normalizeIdentity(beta)) packagingDifferences.push(key)
  }
}
// The two manifests differ by release identity (name, bin, appId, productName,
// artifact names). Compare the parts that carry shared behavior instead of the
// whole document: `scripts` must match modulo identity, except for the entries
// declared below. `build` is declared because the stable edition generates the
// Windows application icon from stable-only tooling before packaging.
const declaredManifestScriptDifferences = new Set(['build'])
const stableManifest = JSON.parse(readFileSync(join(root, 'dsh-plugin-desktop', 'package.json'), 'utf8'))
const betaManifest = JSON.parse(readFileSync(join(root, 'dsh-plugin-desktop-beta', 'package.json'), 'utf8'))
const stableScriptNames = Object.keys(stableManifest.scripts ?? {}).sort()
const betaScriptNames = Object.keys(betaManifest.scripts ?? {}).sort()
if (JSON.stringify(stableScriptNames) !== JSON.stringify(betaScriptNames)) {
  const onlyStable = stableScriptNames.filter(name => !betaScriptNames.includes(name))
  const onlyBeta = betaScriptNames.filter(name => !stableScriptNames.includes(name))
  packagingDifferences.push(`package.json scripts differ (stable-only: ${onlyStable.join(', ') || 'none'}; beta-only: ${onlyBeta.join(', ') || 'none'})`)
}
for (const name of stableScriptNames) {
  if (declaredManifestScriptDifferences.has(name)) continue
  const stableValue = String(stableManifest.scripts[name])
  const betaValue = String(betaManifest.scripts[name])
  if (normalizeIdentity(stableValue) !== normalizeIdentity(betaValue)) {
    packagingDifferences.push(`package.json scripts.${name}`)
  }
}

if (packagingDifferences.length > 0) {
  throw new Error(`Desktop variant packaging drift is not declared:\n${packagingDifferences.map(path => `- ${path}`).join('\n')}`)
}
const packagingCount = PACKAGING_SURFACES.reduce((total, surface) => {
  return total + new Set([...files(join(root, 'dsh-plugin-desktop', surface)), ...files(join(root, 'dsh-plugin-desktop-beta', surface))]).size
}, 1)

process.stdout.write(`verify-desktop-variants: ${String(sharedPaths.size - allowedDifferences.size - betaOnlyPaths.size)} shared source files are aligned; ${String(packagingCount)} packaging entries match; both editions use isolated Host and chrome\n`)
