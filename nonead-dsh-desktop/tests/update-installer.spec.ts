import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('electron', () => ({ autoUpdater: { on: vi.fn() } }))
// `prepare` and the launch both read through PowerShell; the callback shape is what
// promisify(execFile) actually awaits, so a resolved mock alone would hang. Each call answers from
// a queue so a launch can fail while the earlier version probe succeeded.
const helper = vi.hoisted(() => ({
  answers: [] as { error?: Error; stdout?: string }[],
  runs: [] as { script: string; installer?: string }[],
}))
vi.mock('node:child_process', () => ({
  execFile: vi.fn((_file: string, args: readonly string[], options: { env?: Record<string, string | undefined> }, callback: (error: Error | null, result: { stdout: string; stderr: string }) => void) => {
    const index = args.indexOf('-EncodedCommand')
    const script = index < 0 ? '' : Buffer.from(args[index + 1] ?? '', 'base64').toString('utf16le')
    helper.runs.push({ script, installer: options.env?.DSH_UPDATE_INSTALLER })
    const answer = helper.answers.shift()
    if (answer?.error) callback(answer.error, { stdout: '', stderr: '' })
    else callback(null, { stdout: answer?.stdout ?? '', stderr: '' })
  }),
}))
import { NextUpdateInstaller, assertNextMacBundle, assertNextWindowsInstaller } from '../src/update-installer.ts'

beforeEach(() => { vi.clearAllMocks(); helper.answers.length = 0; helper.runs.length = 0 })

const VERSION = '2.0.18-next.1'
const INSTALLER = 'C:/cache/download-1/Nonead-DSH-Desktop-Setup.exe'

async function preparedWindowsInstaller(): Promise<NextUpdateInstaller> {
  helper.answers.push({ stdout: JSON.stringify({ ProductName: 'Nonead DSH Desktop', ProductVersion: '2.0.18-next.1' }) })
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

it('still accepts the space padding the Inno Setup installers wrote into the version resource', () => {
  // Inno padded ProductName/ProductVersion to 60/50 UTF-16 code units, and comparing verbatim made
  // every downloaded update fail with "the installer does not match this Next release". Releases up
  // to 2.2.13 are Inno builds that keep updating themselves from exactly this resource.
  const padded = {
    ProductName: 'Nonead DSH Desktop'.padEnd(60, ' '),
    ProductVersion: '2.0.18-next.1'.padEnd(50, ' '),
  }
  expect(padded.ProductVersion).not.toBe(VERSION)
  expect(() => assertNextWindowsInstaller(padded, VERSION)).not.toThrow()
  expect(() => assertNextWindowsInstaller({ ProductName: 'Nonead DSH Desktop\u0000', ProductVersion: '2.0.18-next.1\u0000  ' }, VERSION)).not.toThrow()
  expect(() => assertNextWindowsInstaller({ ProductName: 'Nonead DSH Desktop', ProductVersion: '2.0.19-next.1' }, VERSION)).toThrow()
})

it('starts the Windows installer through the shell so the elevation prompt can appear', async () => {
  const installer = await preparedWindowsInstaller()
  helper.answers.push({ stdout: '' })
  await expect(installer.launch()).resolves.toBeUndefined()
  const run = helper.runs.at(-1)!
  // The assisted NSIS installer requires administrator, and CreateProcess cannot raise the consent
  // prompt for it (740), so the launch has to go through ShellExecute — Start-Process — instead.
  expect(run.script).toContain('Start-Process -FilePath $env:DSH_UPDATE_INSTALLER -Verb RunAs')
  expect(run.script).not.toContain('-ArgumentList')
  expect(run.installer).toBe(INSTALLER)
})

it('launches the Windows installer once when the shutdown handoff launches it again', async () => {
  const installer = await preparedWindowsInstaller()
  helper.answers.push({ stdout: '' }, { stdout: '' })
  // The Install action starts the installer before quitting; before-quit then re-enters launch
  // and must join the attempt already in flight.
  const first = installer.launch()
  const second = installer.launch()
  await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined])
  await expect(installer.launch()).resolves.toBeUndefined()
  expect(helper.runs).toHaveLength(2)
})

it('keeps a failed Windows launch retryable instead of caching the rejection', async () => {
  const installer = await preparedWindowsInstaller()
  helper.answers.push({ error: new Error('The operation was canceled by the user') }, { stdout: '' })
  await expect(installer.launch()).rejects.toThrow('canceled')
  // Cancelling the consent prompt must leave the downloaded package usable for another attempt.
  await expect(installer.launch()).resolves.toBeUndefined()
  expect(helper.runs).toHaveLength(3)
})
