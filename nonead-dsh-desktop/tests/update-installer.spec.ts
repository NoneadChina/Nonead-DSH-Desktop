import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('electron', () => ({ autoUpdater: { on: vi.fn() } }))
// Windows goes through PowerShell twice: once to read the version resource while preparing, and
// once to start the installer through the shell. The mock records the decoded script and the
// environment that carries the path, so a test can tell the two calls apart and inspect the launch.
const control = vi.hoisted(() => ({
  calls: [] as { script: string; env: NodeJS.ProcessEnv | undefined }[],
  launchFailure: undefined as (Error & { stderr?: string }) | undefined,
}))
vi.mock('node:child_process', () => ({
  execFile: vi.fn((_file: string, args: readonly string[], options: { env?: NodeJS.ProcessEnv }, callback: (error: Error | null, result?: { stdout: string; stderr: string }) => void) => {
    const encoded = args[args.indexOf('-EncodedCommand') + 1] ?? ''
    const script = Buffer.from(encoded, 'base64').toString('utf16le')
    control.calls.push({ script, env: options.env })
    if (!script.includes('Start-Process')) {
      // `prepare` reads the version resource; the callback shape is what promisify(execFile) awaits.
      callback(null, { stdout: JSON.stringify({ ProductName: 'Nonead DSH Desktop', ProductVersion: '2.0.18-next.1' }), stderr: '' })
      return
    }
    callback(control.launchFailure ?? null, { stdout: '', stderr: control.launchFailure?.stderr ?? '' })
  }),
}))
import { NextUpdateInstaller, assertNextMacBundle, assertNextWindowsInstaller, nextInstallerArguments } from '../src/update-installer.ts'

beforeEach(() => { vi.clearAllMocks(); control.calls.length = 0; control.launchFailure = undefined })

const VERSION = '2.0.18-next.1'
const INSTALLER = 'C:/cache/download-1/Nonead-DSH-Desktop-Setup.exe'

async function preparedWindowsInstaller(): Promise<NextUpdateInstaller> {
  const installer = new NextUpdateInstaller({ platform: 'win32', executable: 'C:/app/Nonead DSH Desktop.exe', log: vi.fn() })
  await installer.prepare(INSTALLER, VERSION, 'C:/cache/download-1', new AbortController().signal)
  return installer
}

function launchCalls(): { script: string; env: NodeJS.ProcessEnv | undefined }[] {
  return control.calls.filter(call => call.script.includes('Start-Process'))
}

it('rejects Stable/Beta installers and an unexpected release even when the archive is valid', () => {
  expect(() => assertNextMacBundle('ai.deepseek.dsh.desktop', { name: 'nonead-dsh-desktop', version: '2.0.14-next' }, '2.0.14-next')).not.toThrow()
  expect(() => assertNextMacBundle('ai.deepseek.dsh.desktop.beta', { name: 'nonead-dsh-desktop', version: '2.0.14-next' }, '2.0.14-next')).toThrow()
  expect(() => assertNextMacBundle('ai.deepseek.dsh.desktop', { name: 'nonead-dsh-desktop', version: '2.0.13-next' }, '2.0.14-next')).toThrow()
  expect(() => assertNextWindowsInstaller({ ProductName: 'Nonead DSH Desktop', ProductVersion: '2.0.14-next' }, '2.0.14-next')).not.toThrow()
  expect(() => assertNextWindowsInstaller({ ProductName: 'DSH Desktop Beta', ProductVersion: '2.0.14-next' }, '2.0.14-next')).toThrow()
})

// Inno Setup writes every VersionInfo field into a fixed-width buffer, so a real installer reports
// `ProductVersion` as the version plus trailing spaces and `ProductName` as the name plus trailing
// spaces. Comparing the raw strings rejected every genuine download as "更新未完成，请重试".
it('accepts the space- and NUL-padded version resource Inno Setup produces', () => {
  const padded = { ProductName: `${'Nonead DSH Desktop'.padEnd(60)}`, ProductVersion: '2.0.14-next'.padEnd(50) }
  expect(padded.ProductVersion.length).toBe(50)
  expect(() => assertNextWindowsInstaller(padded, '2.0.14-next')).not.toThrow()
  expect(() => assertNextWindowsInstaller({ ProductName: '\uFEFFNonead DSH Desktop  \u0000', ProductVersion: `\uFEFF${'2.0.14-next'.padEnd(20, '\u0000')}` }, '2.0.14-next')).not.toThrow()
  // Padding is not a whitespace-only difference: a different release is still rejected.
  expect(() => assertNextWindowsInstaller({ ProductName: 'Nonead DSH Desktop   ', ProductVersion: '2.0.13-next'.padEnd(50) }, '2.0.14-next')).toThrow()
})

it('launches the Windows installer visibly as an in-place upgrade', () => {
  const args = nextInstallerArguments('win32')
  // Windows ships electron-builder NSIS: `--updated` keeps the existing install location instead of
  // treating the upgrade as a fresh install that asks for a directory again.
  expect(args).toEqual(['--updated'])
  // `/S` silences the whole run, which made a working install look like nothing started.
  expect(args).not.toContain('/S')
})

it('passes no installer arguments on other platforms', () => {
  expect(nextInstallerArguments('darwin')).toEqual([])
  expect(nextInstallerArguments('linux')).toEqual([])
})

it('starts the Windows installer through the shell without forcing elevation', async () => {
  const installer = await preparedWindowsInstaller()
  await expect(installer.launch()).resolves.toBeUndefined()
  const [launch] = launchCalls()
  expect(launch).toBeDefined()
  // CreateProcess (plain `spawn`) fails with ERROR_ELEVATION_REQUIRED for an image that declares
  // requireAdministrator; Start-Process goes through ShellExecute, which reads the installer
  // manifest itself and raises the consent prompt when, and only when, it asks for elevation.
  expect(launch!.script).toContain('Start-Process -FilePath $env:DSH_UPDATE_INSTALLER')
  // `-Verb RunAs` would elevate unconditionally and break the asInvoker installer for users
  // without admin rights, so the launch must not ask the shell for a specific verb.
  expect(launch!.script).not.toContain('-Verb')
  // The path and arguments travel through the environment, so no installer text is interpolated
  // into the PowerShell program itself.
  expect(launch!.env?.DSH_UPDATE_INSTALLER).toBe(INSTALLER)
  expect(launch!.env?.DSH_UPDATE_ARGS).toBe('--updated')
})

it('starts the Windows installer once when the shutdown handoff launches it again', async () => {
  const installer = await preparedWindowsInstaller()
  // The Install action starts the installer before quitting; before-quit then re-enters launch
  // while the first attempt is already finished and must join it.
  const first = installer.launch()
  const second = installer.launch()
  expect(launchCalls()).toHaveLength(1)
  await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined])
  await expect(installer.launch()).resolves.toBeUndefined()
  expect(launchCalls()).toHaveLength(1)
})

it('keeps a failed Windows launch retryable and keeps the reported reason', async () => {
  const failure = Object.assign(new Error('Command failed: powershell.exe'), { stderr: 'Start-Process : This operation has been cancelled by the user.\r\nAt line:1 char:1\r\n' })
  control.launchFailure = failure
  const installer = await preparedWindowsInstaller()
  const failed = installer.launch()
  await expect(failed).rejects.toMatchObject({ stderr: failure.stderr })
  // The failure is not cached: pressing Install again makes another attempt.
  control.launchFailure = undefined
  await expect(installer.launch()).resolves.toBeUndefined()
  expect(launchCalls()).toHaveLength(2)
})
