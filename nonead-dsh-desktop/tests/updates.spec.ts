import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { NextUpdates, type NextUpdateOptions } from '../src/updates.ts'
import { serveMacUpdate } from '../src/mac-update-feed.ts'
import { updateAction, updateLabel } from '../src/update-state.ts'
import type { UpdateRequest } from '../../dsh-plugin-desktop-beta/src/update-checker.ts'
import type { UpdateArtifactRequest } from '../../dsh-plugin-desktop-beta/src/update-download.ts'

const roots: string[] = []
const owners: NextUpdates[] = []
afterEach(async () => { for (const owner of owners.splice(0)) await owner.dispose(); for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); vi.useRealTimers() })
async function fixture(overrides: Partial<NextUpdateOptions> = {}) {
  const home = await mkdtemp(join(tmpdir(), 'next-updates-test-')); roots.push(home)
  const artifact = Buffer.alloc(1024); artifact.write('koly', 512)
  const request = vi.fn<UpdateRequest>(async url => url.includes('/version')
    ? Response.json({ version: '2.1.4', channel: 'stable' }) : new Response(artifact, { headers: { 'content-length': '1024' } }))
  const artifactRequest = vi.fn<UpdateArtifactRequest>(async (url, init) => ({ response: await request(url, init), finalUrl: url }))
  const options: NextUpdateOptions = { userData: home, version: '2.1.3', platform: 'darwin', packaged: true,
    request, artifactRequest, prepare: vi.fn(async path => { expect(await readFile(path)).toEqual(artifact) }), install: vi.fn(async () => {}),
    changed: vi.fn(), log: vi.fn(), ...overrides }
  const updates = new NextUpdates(options); owners.push(updates)
  return { updates, options, request, artifactRequest }
}

it('checks without downloading; download completion waits for an explicit installation', async () => {
  const { updates, options, request } = await fixture()
  await updates.check()
  expect(updates.snapshot().phase).toBe('available')
  expect(request).toHaveBeenCalledTimes(1)
  await Promise.all([updates.download(), updates.download()])
  expect(updates.snapshot()).toMatchObject({ phase: 'ready', received: 1024, total: 1024 })
  expect(options.prepare).toHaveBeenCalledOnce()
  expect(options.install).not.toHaveBeenCalled()
  await updates.install()
  expect(options.install).toHaveBeenCalledOnce()
  expect(updates.snapshot().phase).toBe('installing')
})
it('does not confuse an unpublished channel, invalid response or network failure with up to date', async () => {
  for (const response of [new Response('', { status: 400 }), new Response('', { status: 503 }), Response.json({ version: '2.1.4', channel: 'beta' })]) {
    const { updates } = await fixture({ request: async () => response })
    await updates.check()
    expect(updates.snapshot()).toMatchObject({ phase: 'error', error: 'service' })
  }
})
it('allows checks in development, but never downloads or replaces the development application', async () => {
  const { updates, options, request } = await fixture({ packaged: false })
  await updates.check(); await updates.download()
  expect(updates.snapshot()).toMatchObject({ installable: false, error: 'development' })
  expect(request).toHaveBeenCalledOnce(); expect(options.prepare).not.toHaveBeenCalled()
})
it('rechecks the selected version before downloading, and preserves preparation failures for retry', async () => {
  const { updates, options } = await fixture({ prepare: async () => { throw new Error('Signature mismatch') } })
  await updates.download()
  expect(updates.snapshot()).toMatchObject({ phase: 'error', error: 'prepare' })
  await updates.install(); expect(options.install).not.toHaveBeenCalled()
  expect(updateAction(updates.snapshot())).toBe('download-update')
})
it('keeps the verified package after a failed install and retries it without downloading again', async () => {
  const install = vi.fn<() => Promise<void>>(async () => { throw new Error('the installer exited before handing off') })
  const { updates, options, artifactRequest } = await fixture({ install })
  await updates.download()
  const path = vi.mocked(options.prepare).mock.calls[0]![0]
  expect(existsSync(path)).toBe(true)
  await updates.install()
  expect(updates.snapshot()).toMatchObject({ phase: 'error', error: 'install', retryInstall: true })
  expect(updateAction(updates.snapshot())).toBe('retry-install-update')
  expect(updateLabel(updates.snapshot(), 'en')).toContain('kept')
  // The failure must hand the same verified package to the retry action, not delete it.
  expect(existsSync(path)).toBe(true)
  expect(artifactRequest).toHaveBeenCalledOnce()
  install.mockImplementationOnce(async () => {})
  await updates.retryInstall()
  expect(install).toHaveBeenCalledTimes(2)
  expect(artifactRequest).toHaveBeenCalledOnce()
  expect(updates.snapshot()).toMatchObject({ phase: 'installing' })
  expect(updates.snapshot().retryInstall).toBeUndefined()
})
it('stays retryable across repeated install failures and keeps the package through shutdown', async () => {
  const install = vi.fn<() => Promise<void>>(async () => { throw new Error('installer failed') })
  const { updates, options } = await fixture({ install })
  // Without a kept package there is nothing to retry.
  await updates.retryInstall(); expect(install).not.toHaveBeenCalled()
  await updates.download()
  const path = vi.mocked(options.prepare).mock.calls[0]![0]
  await updates.install()
  // The ready-only Install action must not restart a failed install behind the retry action.
  await updates.install(); expect(install).toHaveBeenCalledOnce()
  await updates.retryInstall()
  expect(install).toHaveBeenCalledTimes(2)
  expect(updates.snapshot()).toMatchObject({ phase: 'error', error: 'install', retryInstall: true })
  await updates.dispose()
  expect(existsSync(path)).toBe(true)
})
it('stops polling and aborts an active request on shutdown', async () => {
  const request = vi.fn<UpdateRequest>(async (_url, init) => new Promise((_resolve, reject) => init.signal!.addEventListener('abort', () => reject(new Error('aborted')), { once: true })))
  const { updates } = await fixture({ request, packaged: false })
  const check = updates.check()
  await vi.waitFor(() => expect(request).toHaveBeenCalledOnce())
  await updates.dispose(); await check
  expect(request.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
})
it('shows progress and an actionable downloaded state in both languages', () => {
  expect(updateLabel({ phase: 'downloading', installable: true, received: 25, total: 100 }, 'zh-CN')).toContain('25%')
  expect(updateLabel({ phase: 'downloading', installable: true, received: 2 * 1048576 }, 'en')).toContain('2 MB')
  expect(updateAction({ phase: 'preparing', installable: true })).toBeUndefined()
  expect(updateAction({ phase: 'ready', installable: true })).toBe('install-update')
  expect(updateAction({ phase: 'error', error: 'install', retryInstall: true, installable: true })).toBe('retry-install-update')
  // A failure without a kept package still needs the download it lost (the version was recorded
  // before the install attempt, as it is on the live path).
  expect(updateAction({ phase: 'error', error: 'install', version: '2.1.4', installable: true })).toBe('download-update')
  expect(updateLabel({ phase: 'error', error: 'install', retryInstall: true, installable: true }, 'zh-CN')).toContain('重试')
})
it('downloads a Next installer through the injected artifact transport', async () => {
  const cdn = 'https://cdn-lfs-cn-1.modelscope.cn/prod/lfs-objects/next.dmg'
  const artifact = Buffer.alloc(1024); artifact.write('koly', 512)
  const request = vi.fn<UpdateRequest>(async () => Response.json({ version: '2.1.4', channel: 'stable' }))
  const artifactRequest = vi.fn<UpdateArtifactRequest>(async () => ({ response: new Response(artifact), finalUrl: cdn }))
  const { updates, options } = await fixture({ request, artifactRequest })
  await updates.download()
  expect(updates.snapshot()).toMatchObject({ phase: 'ready', version: '2.1.4' })
  expect(artifactRequest).toHaveBeenCalledOnce()
  expect(options.prepare).toHaveBeenCalledOnce()
})
it('publishes release notes with the offered release and drops them with the next answer', async () => {
  const notes = '本次更新修复了若干稳定性问题。'
  const notesUrl = 'https://www.nonead.com/software/ndsh-desktop/releases/2.1.4'
  const request = vi.fn<UpdateRequest>(async () => Response.json({ version: '2.1.4', channel: 'stable', notes, notesUrl }))
  const { updates } = await fixture({ request })
  await updates.check()
  expect(updates.snapshot()).toMatchObject({ phase: 'available', version: '2.1.4', notes, notesUrl })
  // A later answer without notes must not leave the previous summary under the same version.
  request.mockImplementation(async () => Response.json({ version: '2.1.4', channel: 'stable' }))
  await updates.check()
  expect(updates.snapshot().notes).toBeUndefined()
  expect(updates.snapshot().notesUrl).toBeUndefined()
})
it('keeps the offered release notes after the update downloads', async () => {
  const notes = '本次更新修复了若干稳定性问题。'
  const notesUrl = 'https://www.nonead.com/software/ndsh-desktop/releases/2.1.4'
  const request = vi.fn<UpdateRequest>(async () => Response.json({ version: '2.1.4', channel: 'stable', notes, notesUrl }))
  const { updates } = await fixture({ request })
  await updates.check()
  await updates.download()
  expect(updates.snapshot()).toMatchObject({ phase: 'ready', version: '2.1.4', notes, notesUrl })
})
it('serves only the private archive to the native updater and closes its loopback listener', async () => {
  const root = await mkdtemp(join(tmpdir(), 'next-feed-test-')); roots.push(root)
  const path = join(root, 'update.zip'); await writeFile(path, 'test archive')
  const feed = await serveMacUpdate(path, '2.1.4')
  try {
    const metadata = await (await fetch(feed.url)).json() as { url: string; name: string }
    expect(metadata.name).toBe('2.1.4')
    expect(await (await fetch(metadata.url)).text()).toBe('test archive')
    expect((await fetch(new URL('/update.zip', feed.url))).status).toBe(404)
    expect((await fetch(feed.url, { method: 'POST' })).status).toBe(404)
  } finally { await feed.close() }
  await expect(fetch(feed.url)).rejects.toThrow()
})
