import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { NextProfiles } from '../src/profiles.ts'
import { NextRecovery } from '../src/recovery.ts'

const homes: string[] = []
function fixture() {
  const home = mkdtempSync(join(tmpdir(), 'next-recovery-'))
  homes.push(home)
  const profiles = new NextProfiles(home)
  const directory = profiles.ensure('desktop')
  return { home, directory, profiles, recovery: new NextRecovery(profiles) }
}
afterEach(() => { vi.restoreAllMocks(); homes.splice(0).forEach(home => rmSync(home, { recursive: true, force: true })) })

it('shows three healthy checkpoints and restores the selected older snapshot, preserving current configuration first', async () => {
  const { directory, recovery } = fixture()
  const clock = vi.spyOn(Date, 'now')
  for (let index = 1; index <= 4; index++) {
    clock.mockReturnValue(1000 + index)
    writeFileSync(join(directory, 'cordis.patch.yml'), `# version ${index}\n[]\n`)
    recovery.checkpoint('desktop')
  }
  const checkpoints = recovery.checkpoints('desktop')
  expect(checkpoints).toHaveLength(3)
  expect(checkpoints.map(item => item.id.split('-')[0])).toEqual(['1004', '1003', '1002'])
  await recovery.restore('desktop', checkpoints[2]!.id)
  expect(readFileSync(join(directory, 'cordis.patch.yml'), 'utf8')).toContain('version 2')
  expect(readdirSync(recovery.directory)).toHaveLength(5)
  await expect(recovery.restore('desktop', '../outside')).rejects.toThrow('No recovery checkpoint')
})

it('rejects a tampered backup before changing any live configuration', async () => {
  const { directory, recovery } = fixture()
  recovery.checkpoint('desktop')
  const checkpoint = recovery.checkpoints('desktop')[0]!
  writeFileSync(join(checkpoint.directory, 'package.json'), '{}')
  const before = readFileSync(join(directory, 'package.json'), 'utf8')
  await expect(recovery.restore('desktop', checkpoint.id)).rejects.toThrow('checksum')
  expect(readFileSync(join(directory, 'package.json'), 'utf8')).toBe(before)
})

it('protects core bundles and backs up all user data on reset without moving Electron or existing backups', () => {
  const { home, directory, recovery } = fixture()
  const path = join(directory, 'package.json')
  const manifest = JSON.parse(readFileSync(path, 'utf8'))
  manifest.dsh.profile.bundles.push('my-plugin')
  writeFileSync(path, JSON.stringify(manifest))
  expect(recovery.bundles('desktop').find(item => item.packageName === 'nonead-dsh-desktop')).toBeUndefined()
  expect(recovery.bundles('desktop').find(item => item.packageName === 'my-plugin')?.action).toBe('uninstall')
  recovery.checkpoint('desktop')
  mkdirSync(join(home, 'electron-user-data'))
  writeFileSync(join(home, 'settings.yaml'), 'original settings')
  writeFileSync(join(home, 'nonead-dsh-desktop-location.json'), '{}')
  const backup = recovery.factoryReset()
  expect(readFileSync(join(backup, 'settings.yaml'), 'utf8')).toBe('original settings')
  expect(readFileSync(join(backup, 'profiles/desktop/package.json'), 'utf8')).toBe(JSON.stringify(manifest))
  expect(readdirSync(home).sort()).toEqual(['electron-user-data', 'nonead-dsh-desktop-location.json', 'recovery'])
  expect(recovery.checkpoints('desktop')).toHaveLength(1)
})


it('omits shipped optional and official bundles from recovery while retaining third-party plugins', () => {
  const { directory, recovery } = fixture()
  const path = join(directory, 'package.json')
  const manifest = JSON.parse(readFileSync(path, 'utf8'))
  manifest.dsh.profile.bundles.push(
    '@agents-anywhere/dsh-bridge-next', 'dsh-community-market', 'dshmarket',
    '@deepseek-ai/dsh-experimental-agent-team-profile',
    '@deepseek-ai/future-official-plugin',
    'third-party-plugin', '@community/example', 'third-party-plugin',
  )
  writeFileSync(path, JSON.stringify(manifest))
  expect(recovery.bundles('desktop').map(item => item.packageName)).toEqual(['third-party-plugin', '@community/example'])
  expect(recovery.bundles('desktop').every(item => item.action === 'uninstall')).toBe(true)
})

it('disables and re-enables a bundle without deleting its dependency, taking a backup each time', async () => {
  const { directory, recovery } = fixture()
  const path = join(directory, 'package.json')
  const manifest = JSON.parse(readFileSync(path, 'utf8'))
  manifest.dsh.profile.bundles.push('my-plugin')
  manifest.dependencies = { ...manifest.dependencies, 'my-plugin': '1.0.0' }
  writeFileSync(path, JSON.stringify(manifest))
  expect(recovery.bundles('desktop').find(item => item.packageName === 'my-plugin')?.toggle).toBe('disable')

  await recovery.setBundleSelected('desktop', 'my-plugin', false)
  const disabled = JSON.parse(readFileSync(path, 'utf8'))
  expect(disabled.dsh.profile.bundles).not.toContain('my-plugin')
  expect(disabled.dependencies['my-plugin']).toBe('1.0.0')
  expect(disabled.dsh.desktopNextDeselectedBundles).toEqual(['my-plugin'])
  expect(recovery.bundles('desktop').find(item => item.packageName === 'my-plugin'))
    .toMatchObject({ status: 'disabled', action: 'uninstall', toggle: 'enable' })
  expect(readdirSync(recovery.directory)).toHaveLength(1)

  await recovery.setBundleSelected('desktop', 'my-plugin', true)
  const enabled = JSON.parse(readFileSync(path, 'utf8'))
  expect(enabled.dsh.profile.bundles).toContain('my-plugin')
  expect(enabled.dsh.desktopNextDeselectedBundles).toBeUndefined()
  expect(recovery.bundles('desktop').find(item => item.packageName === 'my-plugin')?.toggle).toBe('disable')
  expect(readdirSync(recovery.directory)).toHaveLength(2)
})

it('refuses a protected, unknown, or already-applied selection change', async () => {
  const { directory, recovery } = fixture()
  const path = join(directory, 'package.json')
  const manifest = JSON.parse(readFileSync(path, 'utf8'))
  manifest.dsh.profile.bundles.push('my-plugin', 'dsh-community-market')
  manifest.dependencies = { ...manifest.dependencies, 'my-plugin': '1.0.0' }
  writeFileSync(path, JSON.stringify(manifest))
  const before = readFileSync(path, 'utf8')

  for (const [name, selected] of [
    ['dsh-community-market', false],
    ['nonead-dsh-desktop', false],
    ['never-installed', false],
    ['my-plugin', true],
  ] as const) {
    await expect(recovery.setBundleSelected('desktop', name, selected))
      .rejects.toThrow('cannot be changed')
  }
  expect(readFileSync(path, 'utf8')).toBe(before)
})

it('forgets a ledger entry once the bundle is reselected or its dependency is gone', async () => {
  const { directory, recovery } = fixture()
  const path = join(directory, 'package.json')
  const manifest = JSON.parse(readFileSync(path, 'utf8'))
  manifest.dsh.profile.bundles.push('my-plugin')
  manifest.dependencies = { ...manifest.dependencies, 'my-plugin': '1.0.0' }
  writeFileSync(path, JSON.stringify(manifest))
  await recovery.setBundleSelected('desktop', 'my-plugin', false)

  const reselected = JSON.parse(readFileSync(path, 'utf8'))
  reselected.dsh.profile.bundles.push('my-plugin')
  writeFileSync(path, JSON.stringify(reselected))
  expect(recovery.bundles('desktop').filter(item => item.packageName === 'my-plugin'))
    .toEqual([expect.objectContaining({ status: 'active', toggle: 'disable' })])

  const removed = JSON.parse(readFileSync(path, 'utf8'))
  removed.dsh.profile.bundles = removed.dsh.profile.bundles.filter((name: string) => name !== 'my-plugin')
  delete removed.dependencies['my-plugin']
  writeFileSync(path, JSON.stringify(removed))
  expect(recovery.bundles('desktop').some(item => item.packageName === 'my-plugin')).toBe(false)
})

it('lists and restores a snapshot no successful start produced, keeping that rollback reversible', async () => {
  const { directory, recovery } = fixture()
  const clock = vi.spyOn(Date, 'now')
  let now = Date.now()
  clock.mockImplementation(() => (now += 1))
  recovery.checkpoint('desktop')
  const patch = join(directory, 'cordis.patch.yml')
  writeFileSync(patch, '# before repair\n[]\n')
  const repair = basename(recovery.backup('desktop', 'before-profile-repair'))
  writeFileSync(patch, '# repaired\n[]\n')

  // The implicit rollback chooser still offers only configurations known to start.
  expect(recovery.checkpoints('desktop')).toHaveLength(1)
  expect(recovery.checkpoints('desktop')[0]).toMatchObject({ kind: 'successful-start', healthy: true })
  // The data layer exposes every snapshot with the reason it exists.
  expect(recovery.list('desktop').map(item => item.kind)).toEqual(['before-profile-repair', 'successful-start'])
  expect(recovery.list('desktop', 1).map(item => item.id)).toEqual([repair])
  expect(recovery.find('desktop', repair)).toMatchObject({
    id: repair, kind: 'before-profile-repair', healthy: false, directory: join(recovery.directory, repair),
    fileCount: expect.any(Number), totalBytes: expect.any(Number),
  })

  await recovery.restore('desktop', repair)
  expect(readFileSync(patch, 'utf8')).toBe('# before repair\n[]\n')
  // Restoring snapshotted the state it replaced, so this rollback can be undone.
  const rollback = recovery.list('desktop').find(item => item.kind === 'before-rollback')
  expect(rollback).toBeDefined()
  expect(rollback).toMatchObject({ healthy: false, kind: 'before-rollback' })
  await recovery.restore('desktop', rollback!.id)
  expect(readFileSync(patch, 'utf8')).toBe('# repaired\n[]\n')
})

it('never rolls back to a snapshot that was not known to start unless it is named explicitly', async () => {
  const { recovery } = fixture()
  recovery.backup('desktop', 'before-plugin-disable')
  expect(recovery.checkpoints('desktop')).toEqual([])
  await expect(recovery.restore('desktop')).rejects.toThrow('No recovery checkpoint')
  expect(recovery.list('desktop').map(item => ({ kind: item.kind, healthy: item.healthy })))
    .toEqual([{ kind: 'before-plugin-disable', healthy: false }])
})

it('rejects an unknown or traversing checkpoint id without touching configuration', async () => {
  const { directory, recovery } = fixture()
  recovery.checkpoint('desktop')
  const manifest = readFileSync(join(directory, 'package.json'), 'utf8')
  for (const id of ['../outside', 'not-a-checkpoint', '1000-00000000-0000-0000-0000-000000000000']) {
    expect(recovery.find('desktop', id)).toBeUndefined()
    await expect(recovery.restore('desktop', id)).rejects.toThrow('No recovery checkpoint')
  }
  expect(readFileSync(join(directory, 'package.json'), 'utf8')).toBe(manifest)
  expect(recovery.list('desktop')).toHaveLength(1)
})
