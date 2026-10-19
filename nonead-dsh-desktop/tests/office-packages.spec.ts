import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { officePackageDirectories, officeUnpackPatterns, selectOfficeEngine } from '../scripts/office-packages.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
// Spell package directories the way the unpack patterns and the assertions below do, with forward slashes: relative() returns native separators, so a Windows host would otherwise report `@deepseek-ai\libreoffice-kit` and fail on formatting alone.
const names = (platform: string, arch: string): string[] => officePackageDirectories(root, { platform, arch }).map(directory => relative(join(root, 'node_modules'), directory).split(sep).join('/'))
// The Darwin closure is installed only where the host resolves other platforms' optional dependencies (a Darwin host, or supportedArchitectures covering darwin). Asserting an absent closure would only report the host, so skip instead.
const darwinClosureInstalled = ((): boolean => {
  try {
    return names('darwin', 'x64').length > 0
  } catch {
    // officePackageDirectories throws when the host has no Darwin engine installed; that is a missing closure, not a defect.
    return false
  }
})()

it.skipIf(!darwinClosureInstalled)('resolves the installed Office closure with the native engine of each Darwin CPU', () => {
  const arm64 = names('darwin', 'arm64')
  expect(arm64).toEqual(expect.arrayContaining(['@deepseek-ai/libreoffice-kit', '@deepseek-ai/libreoffice-kit-darwin-arm64', '@koromix/koffi-darwin-arm64', 'fflate', 'fontkit', 'koffi', 'saxes']))
  expect(arm64).not.toContain('@deepseek-ai/libreoffice-kit-darwin-x64')
  expect(arm64).not.toContain('@koromix/koffi-darwin-x64')
  const x64 = names('darwin', 'x64')
  expect(x64).toContain('@deepseek-ai/libreoffice-kit-darwin-x64')
  expect(x64).toContain('@koromix/koffi-darwin-x64')
  expect(x64).not.toContain('@deepseek-ai/libreoffice-kit-darwin-arm64')
})

it('unpacks the union of both CPUs once as application-relative globs', () => {
  const patterns = officeUnpackPatterns(root, 'darwin', ['arm64', 'x64'])
  for (const name of ['@deepseek-ai/libreoffice-kit', '@deepseek-ai/libreoffice-kit-darwin-arm64', '@deepseek-ai/libreoffice-kit-darwin-x64', 'fflate', 'fontkit', 'koffi', 'saxes']) {
    expect(patterns).toContain(`**/node_modules/${name}/**/*`)
  }
  expect(new Set(patterns).size).toBe(patterns.length)
  expect(patterns.every(pattern => /^\*\*\/node_modules\/.+\/\*\*\/\*$/u.test(pattern))).toBe(true)
})

it('selects WASM for a target without a declared native engine', () => {
  const manifest = { optionalDependencies: { '@deepseek-ai/libreoffice-kit-darwin-arm64': '0.1.5' } }
  expect(selectOfficeEngine(manifest, { platform: 'darwin', arch: 'arm64' })).toBe('darwin-arm64')
  expect(selectOfficeEngine(manifest, { platform: 'linux', arch: 'x64' })).toBe('wasm')
})
