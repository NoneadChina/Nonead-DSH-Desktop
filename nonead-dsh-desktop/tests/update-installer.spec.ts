import { EventEmitter } from 'node:events'
import { spawn, type ChildProcess } from 'node:child_process'
import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('electron', () => ({ autoUpdater: { on: vi.fn() } }))
// `prepare` reads the Windows version resource through PowerShell; the callback shape is what
// promisify(execFile) actually awaits, so a resolved mock alone would hang.
vi.mock('node:child_process', () => ({
  execFile: vi.fn((_file: string, _args: readonly string[], _options: unknown, callback: (error: Error | null, result: { stdout: string; stderr: string }) => void) => {
    callback(null, { stdout: JSON.stringify({ ProductName: 'Nonead DSH Desktop', ProductVersion: '2.0.18-next.1' }), stderr: '' })
  }),
  spawn: vi.fn(),
}))
import { NextUpdateInstaller, assertNextMacBundle, assertNextWindowsInstaller, nextInstallerArguments } from '../src/update-installer.ts'

beforeEach(() => { vi.clearAllMocks() })

const VERSION = '2.0.18-next.1'
const INSTALLER = 'C:/cache/download-1/Nonead-DSH-Desktop-Setup.exe'

async function preparedWindowsInstaller(): Promise<NextUpdateInstaller> {
  const installer = new NextUpdateInstaller({ platform: 'win32', executable: 'C:/app/Nonead DSH Desktop.exe', log: vi.fn() })
  await installer.prepare(INSTALLER, VERSION, 'C:/cache/download-1', new AbortController().signal)
  return installer
}

it('rejects Stable/Beta installers and an unexpected release even when the archive is valid', () => {
  expect(() => assertNextMacBundle('ai.deepseek.dsh.desktop', { name: 'nonead-dsh-desktop', version: '2.0.14-next' }, '2.0.14-next')).not.toThrow()
  expect(() => assertNextMacBundle('ai.deepseek.dsh.desktop.beta', { name: 'nonead-dsh-desktop', version: '2.0.14-next' }, '2.0.14-next')).toThrow()
  expect(() => assertNextMacBundle('ai.deepseek.dsh.desktop', { name: 'nonead-dsh-desktop', version: '2.0.13-next' }, '2.0.14-next')).toThrow()
  expect(() => assertNextWindowsInstaller({ ProductName: 'Nonead DSH Desktop', ProductVersion: '2.0.14-next' }, '2.0.14-next')).not.toThrow()
  expect(() => assertNextWindowsInstaller({ ProductName: 'DSH Desktop Beta', ProductVersion: '2.0.14-next' }, '2.0.14-next')).toThrow()
})

it('launches the Windows installer visibly in update mode', () => {
  const args = nextInstallerArguments('win32')
  expect(args).toContain('--updated')
  // `/S` silences the whole run, which made a working install look like nothing started.
  expect(args).not.toContain('/S')
})

it('passes no installer arguments on other platforms', () => {
  expect(nextInstallerArguments('darwin')).toEqual([])
  expect(nextInstallerArguments('linux')).toEqual([])
})

it('spawns the Windows installer once when the shutdown handoff launches it again', async () => {
  const child = Object.assign(new EventEmitter(), { unref: vi.fn() })
  vi.mocked(spawn).mockReturnValue(child as unknown as ChildProcess)
  const installer = await preparedWindowsInstaller()
  // The Install action starts the installer before quitting; before-quit then re-enters launch
  // while the first attempt is still in flight (or already finished) and must join it.
  const first = installer.launch()
  const second = installer.launch()
  expect(spawn).toHaveBeenCalledOnce()
  expect(spawn).toHaveBeenCalledWith(INSTALLER, ['--updated'], { detached: true, stdio: 'ignore', shell: false, windowsHide: false })
  child.emit('spawn')
  await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined])
  await expect(installer.launch()).resolves.toBeUndefined()
  expect(spawn).toHaveBeenCalledOnce()
})

it('keeps a failed Windows launch retryable instead of caching the rejection', async () => {
  const child = Object.assign(new EventEmitter(), { unref: vi.fn() })
  vi.mocked(spawn).mockReturnValue(child as unknown as ChildProcess)
  const installer = await preparedWindowsInstaller()
  const failed = installer.launch()
  child.emit('error', new Error('spawn ENOENT'))
  await expect(failed).rejects.toThrow('spawn ENOENT')
  const retry = installer.launch()
  expect(spawn).toHaveBeenCalledTimes(2)
  child.emit('spawn')
  await expect(retry).resolves.toBeUndefined()
})
