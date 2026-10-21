import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { NextUpdates, type NextUpdateOptions } from '../src/updates.ts'
import { clearSkippedVersion, readSkippedVersion, skippedVersionFile, writeSkippedVersion } from '../src/update-skip.ts'
import { updateAction, updateLabel } from '../src/update-state.ts'
import type { UpdateRequest } from '../../dsh-plugin-desktop-beta/src/update-checker.ts'
import type { UpdateArtifactRequest } from '../../dsh-plugin-desktop-beta/src/update-download.ts'

const roots: string[] = []
const owners: NextUpdates[] = []
afterEach(async () => { for (const owner of owners.splice(0)) await owner.dispose(); for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }) })
async function home(): Promise<string> { const root = await mkdtemp(join(tmpdir(), 'next-update-skip-')); roots.push(root); return root }

async function fixture(version: () => string, existing?: string) {
  const userData = existing ?? await home()
  const request = vi.fn<UpdateRequest>(async () => Response.json({ version: version(), channel: 'stable' }))
  const artifactRequest = vi.fn<UpdateArtifactRequest>(async (url, init) => ({ response: await request(url, init), finalUrl: url }))
  const options: NextUpdateOptions = { userData, version: '2.1.3', platform: 'darwin', packaged: true, request, artifactRequest,
    prepare: vi.fn(async () => {}), install: vi.fn(async () => {}), changed: vi.fn(), log: vi.fn() }
  const updates = new NextUpdates(options); owners.push(updates)
  return { updates, options }
}

it('stores the skipped version and ignores an unreadable or malformed record', async () => {
  const userData = await home()
  expect(readSkippedVersion(userData)).toBeUndefined()
  writeSkippedVersion(userData, '2.1.4')
  expect(readSkippedVersion(userData)).toBe('2.1.4')
  expect(JSON.parse(await readFile(skippedVersionFile(userData), 'utf8'))).toEqual({ version: '2.1.4' })
  clearSkippedVersion(userData)
  expect(readSkippedVersion(userData)).toBeUndefined()
  // A record that no longer parses must not block updates: it reads as "nothing skipped".
  await writeFile(skippedVersionFile(userData), '{"version":"not a version"}')
  expect(readSkippedVersion(userData)).toBeUndefined()
  await writeFile(skippedVersionFile(userData), 'not json at all')
  expect(readSkippedVersion(userData)).toBeUndefined()
  // The version becomes part of a JSON record, so anything else is refused.
  expect(() => writeSkippedVersion(userData, '../../etc/passwd')).toThrow()
})

it('only skips a release that was actually offered', async () => {
  const { updates, options } = await fixture(() => '2.1.4')
  updates.skip()
  expect(updates.snapshot().phase).toBe('idle')
  expect(readSkippedVersion(options.userData)).toBeUndefined()
})

it('keeps a skipped release hidden across a restart until a newer one appears', async () => {
  let version = '2.1.4'
  const first = await fixture(() => version)
  await first.updates.check()
  expect(first.updates.snapshot()).toMatchObject({ phase: 'available', version: '2.1.4' })
  first.updates.skip()
  expect(first.updates.snapshot()).toMatchObject({ phase: 'skipped', version: '2.1.4' })
  expect(updateAction(first.updates.snapshot())).toBe('check-updates')
  expect(readSkippedVersion(first.options.userData)).toBe('2.1.4')

  // A restarted process reads the decision before its first check offers anything.
  const second = await fixture(() => version, first.options.userData)
  await second.updates.check()
  expect(second.updates.snapshot()).toMatchObject({ phase: 'skipped', version: '2.1.4' })
  // A skipped release is never downloaded, even when a stale action asks for it.
  await second.updates.download()
  expect(second.options.artifactRequest).not.toHaveBeenCalled()
  expect(second.updates.snapshot()).toMatchObject({ phase: 'skipped', version: '2.1.4' })

  // A newer release supersedes the skip and drops the stale record.
  version = '2.1.5'
  await second.updates.check()
  expect(second.updates.snapshot()).toMatchObject({ phase: 'available', version: '2.1.5' })
  expect(readSkippedVersion(second.options.userData)).toBeUndefined()
})

it('undoes a skip so the same release is offered again', async () => {
  const { updates, options } = await fixture(() => '2.1.4')
  await updates.check()
  updates.skip()
  expect(updates.snapshot().phase).toBe('skipped')
  await updates.clearSkip()
  expect(updates.snapshot()).toMatchObject({ phase: 'available', version: '2.1.4' })
  expect(readSkippedVersion(options.userData)).toBeUndefined()
})

it('labels a skipped release in both languages', () => {
  expect(updateLabel({ phase: 'skipped', version: '2.1.4', installable: true }, 'zh-CN')).toContain('已跳过版本 2.1.4')
  expect(updateLabel({ phase: 'skipped', version: '2.1.4', installable: true }, 'en')).toContain('Version 2.1.4 skipped')
  expect(updateAction({ phase: 'skipped', version: '2.1.4', installable: true })).toBe('check-updates')
})
