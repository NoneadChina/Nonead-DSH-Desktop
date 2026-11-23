import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ensureNsisStubFix } from '../scripts/nsis-stub-fix.ts'

const TARGET_FILE = join('app-builder-lib', 'out', 'targets', 'nsis', 'NsisTarget.js')
const MARKER = 'DSH-LOCAL running uninstaller stub copy'

/** The upstream call this fix replaces, copied verbatim from the generator in the script. */
const STOCK = [
  '            const wineVm = new WineVm_1.WineVmManager((_a = packager.config.toolsets) === null || _a === void 0 ? void 0 : _a.wine);',
  '            await wineVm.exec(installerPath, [], { env: { __COMPAT_LAYER: "RunAsInvoker" } });',
].join('\n')

const roots: string[] = []

function workspace(): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-nsis-fix-'))
  roots.push(root)
  return root
}

function builderCli(root: string): string {
  return join(root, 'node_modules', 'electron-builder', 'cli.js')
}

function targetUnder(root: string): string {
  return join(root, 'node_modules', TARGET_FILE)
}

function install(root: string, body: string): string {
  const target = targetUnder(root)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, body, 'utf8')
  mkdirSync(dirname(builderCli(root)), { recursive: true })
  writeFileSync(builderCli(root), '#!/usr/bin/env node\n', 'utf8')
  return target
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('NSIS uninstaller stub fix', () => {
  it('reports skipped when no app-builder-lib copy can be located', () => {
    const logs: string[] = []
    expect(ensureNsisStubFix(builderCli(workspace()), message => logs.push(message))).toBe('skipped')
    expect(logs).toEqual([])
  })

  it('patches the copy reachable from the builder CLI', () => {
    const root = workspace()
    const target = install(root, `function a() {\n${STOCK}\n}\n`)
    const logs: string[] = []

    expect(ensureNsisStubFix(builderCli(root), message => logs.push(message))).toBe('patched')
    expect(readFileSync(target, 'utf8')).toContain(MARKER)
    expect(readFileSync(target, 'utf8')).not.toContain(STOCK)
    expect(logs).toEqual([`Applied the NSIS uninstaller stub fix to ${target}`])
  })

  it('patches a second copy installed under another workspace root', () => {
    const builderRoot = workspace()
    const desktopRoot = workspace()
    const builderTarget = install(builderRoot, `function a() {\n${STOCK}\n}\n`)
    const desktopTarget = install(desktopRoot, `function a() {\n${STOCK}\n}\n`)
    const logs: string[] = []

    expect(ensureNsisStubFix(builderCli(builderRoot), message => logs.push(message), [desktopRoot])).toBe('patched')
    for (const target of [builderTarget, desktopTarget]) {
      expect(readFileSync(target, 'utf8')).toContain(MARKER)
      expect(logs).toContain(`Applied the NSIS uninstaller stub fix to ${target}`)
    }
  })

  it('treats an already patched copy as a no-op', () => {
    const root = workspace()
    const target = install(root, `// ${MARKER}\nfunction a() {}\n`)
    const before = readFileSync(target, 'utf8')
    const logs: string[] = []

    expect(ensureNsisStubFix(builderCli(root), message => logs.push(message), [root])).toBe('already patched')
    expect(readFileSync(target, 'utf8')).toBe(before)
    expect(logs).toEqual([`NSIS uninstaller stub fix already applied: ${target}`])
  })

  it('fails loudly when a located copy matches neither shape', () => {
    const root = workspace()
    const target = install(root, 'function a() {}\n')

    expect(() => ensureNsisStubFix(builderCli(root), () => {})).toThrow(
      `DSH-LOCAL: ${target} neither carries the NSIS stub fix nor the stock call it replaces.`,
    )
  })
})
