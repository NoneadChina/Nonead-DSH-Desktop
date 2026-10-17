import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { applyProfilePluginPatches, patchBetterSidebar } from '../src/profile-plugin-patches.ts'

const OLD_LIB = [
  'const inject = [',
  '\t"webServer",',
  '\t"sessions",',
  '\t"webRuntime",',
  '\t"tools"',
  '];',
  'const fence = (req) => isTrustedApiRequest(req, ctx.webRuntime.trustedHosts);',
  'router.post("/api", (req) => fence(req));',
  '',
].join('\n')

function profileWithPlugin(lib: string): string {
  const profile = mkdtempSync(join(tmpdir(), 'dsh-plugin-patch-'))
  const dir = join(profile, 'node_modules', 'dsh-better-sidebar', 'lib')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'index.js'), lib, 'utf8')
  return profile
}

it('rewrites the removed webRuntime dependency and keeps a backup', () => {
  const profile = profileWithPlugin(OLD_LIB)
  const lib = join(profile, 'node_modules', 'dsh-better-sidebar', 'lib', 'index.js')
  const report = patchBetterSidebar(profile)
  expect(report.patched).toHaveLength(1)
  const patched = readFileSync(lib, 'utf8')
  expect(patched).not.toContain('"webRuntime"')
  expect(patched).toContain('connection.isTrusted')
  expect(patched).toContain('webStartup.trustedHosts')
  const backups = readdirSync(join(profile, 'node_modules', 'dsh-better-sidebar', 'lib'))
    .filter(name => name.startsWith('index.js.bak-'))
  expect(backups).toHaveLength(1)
  expect(readFileSync(join(profile, 'node_modules', 'dsh-better-sidebar', 'lib', backups[0]!), 'utf8')).toBe(OLD_LIB)
})

it('is idempotent: a second run leaves the patched file untouched', () => {
  const profile = profileWithPlugin(OLD_LIB)
  patchBetterSidebar(profile)
  const lib = join(profile, 'node_modules', 'dsh-better-sidebar', 'lib', 'index.js')
  const once = readFileSync(lib, 'utf8')
  const second = patchBetterSidebar(profile)
  expect(second.patched).toHaveLength(0)
  expect(second.skipped.some(entry => entry.includes('already patched'))).toBe(true)
  expect(readFileSync(lib, 'utf8')).toBe(once)
})

it('does nothing when the plugin is not installed', () => {
  const profile = mkdtempSync(join(tmpdir(), 'dsh-plugin-absent-'))
  const report = applyProfilePluginPatches(profile)
  expect(report.patched).toHaveLength(0)
  expect(report.skipped).toHaveLength(0)
})

it('refuses to half-patch a plugin whose source changed shape', () => {
  const changed = OLD_LIB.replace('ctx.webRuntime.trustedHosts', 'ctx.somethingElse')
  const profile = profileWithPlugin(changed)
  const report = patchBetterSidebar(profile)
  expect(report.patched).toHaveLength(0)
  expect(report.skipped.some(entry => entry.includes('unexpected plugin source'))).toBe(true)
  expect(readFileSync(join(profile, 'node_modules', 'dsh-better-sidebar', 'lib', 'index.js'), 'utf8')).toBe(changed)
})

it('tolerates an invalid profile path without throwing', () => {
  const report = applyProfilePluginPatches('\u0000invalid')
  expect(report.patched).toHaveLength(0)
  expect(report.skipped).toHaveLength(0)
})
