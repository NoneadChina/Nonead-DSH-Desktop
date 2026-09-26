import { fileURLToPath } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import type { ShellExecSpec, ShellExecution } from '@deepseek-ai/dsh-shell'
import type { SubprocessHandle, SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess'
import type { Config as PwshConfig } from '@deepseek-ai/dsh-pwsh-local'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  adaptWindowsAclExecution,
  DesktopWindowsPwshSandbox,
  desktopWindowsPwshConfig,
  desktopWindowsPwshPath,
  type WindowsAclAdaptation,
} from '../src/windows-pwsh-sandbox.ts'
const RUN_AS_NODE = 'ELECTRON_RUN_AS_NODE'
const SYSTEM_POWERSHELL = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'

function shellSpec(env?: Record<string, string>): ShellExecSpec {
  return {
    command: 'Write-Output ok',
    workdir: 'C:\\workspace',
    timeoutMs: 60_000,
    stdoutMaxBytes: 64_000,
    onExpiry: 'kill',
    sandboxPolicy: undefined,
    ...(env === undefined ? {} : { env }),
  }
}

/** A resolved pwsh-local configuration: every volatile field is read through `get()`. */
function pwshConfig(declaredPwshPath?: string): PwshConfig {
  return {
    cwd: { get: () => undefined },
    timeoutMs: { get: () => 120_000 },
    maxTimeoutMs: { get: () => 600_000 },
    maxOutputBytes: { get: () => 64_000 },
    maxSpillBytes: { get: () => 64 * 1024 * 1024 },
    graceMs: { get: () => 5_000 },
    pwshPath: { get: () => declaredPwshPath },
  }
}

const adaptation: WindowsAclAdaptation = {
  platform: 'win32',
  electron: true,
  execPath: 'C:\\Program Files\\Nonead DSH Desktop\\Nonead DSH Desktop.exe',
  upstreamRunner: 'C:\\Program Files\\Nonead DSH Desktop\\resources\\app.asar\\runner.js',
  trampoline: 'C:\\Program Files\\Nonead DSH Desktop\\resources\\app.asar\\desktop-runner.js',
}

describe('Windows Electron PowerShell sandbox adaptation', () => {
  it('prefers stable Windows PowerShell locations over PATH-provided portable pwsh', () => {
    const programFilesPwsh = desktopWindowsPwshPath({
      ProgramFiles: 'C:\\Program Files',
      SystemRoot: 'C:\\Windows',
      PATH: 'D:\\AI-Agent\\tools\\pwsh',
    }, 'win32', path => path === 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe')

    expect(programFilesPwsh).toBe('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe')
  })

  it('keeps the regular Program Files PowerShell 7 install as the first Windows choice', () => {
    const programFilesPwsh = desktopWindowsPwshPath({
      ProgramFiles: 'C:\\Program Files',
      SystemRoot: 'C:\\Windows',
    }, 'win32', () => true)

    expect(programFilesPwsh).toBe('C:\\Program Files\\PowerShell\\7\\pwsh.exe')
  })

  it('keeps explicit pwshPath config and non-Windows config unchanged', () => {
    const explicit = pwshConfig('D:\\tools\\pwsh\\pwsh.exe')
    expect(desktopWindowsPwshConfig(explicit, {}, 'win32')).toBe(explicit)

    const nonWindows = pwshConfig()
    expect(desktopWindowsPwshConfig(nonWindows, {}, 'darwin')).toBe(nonWindows)
  })

  it('defaults Windows sandbox config to a stable system PowerShell when available', () => {
    const configured = pwshConfig()
    const result = desktopWindowsPwshConfig(configured, {
      ProgramFiles: 'C:\\missing',
      SystemRoot: 'C:\\Windows',
      PATH: 'D:\\portable\\pwsh',
    }, 'win32', path => path === SYSTEM_POWERSHELL)

    expect(result).not.toBe(configured)
    expect(result.cwd).toBe(configured.cwd)
    expect(result.pwshPath.get()).toBe(SYSTEM_POWERSHELL)
  })

  it('lets a pwshPath declared after startup override the derived Windows default', () => {
    let declared: string | undefined
    const configured: PwshConfig = { ...pwshConfig(), pwshPath: { get: () => declared } }
    const result = desktopWindowsPwshConfig(configured, {
      ProgramFiles: 'C:\\missing',
      SystemRoot: 'C:\\Windows',
    }, 'win32', path => path === SYSTEM_POWERSHELL)

    expect(result.pwshPath.get()).toBe(SYSTEM_POWERSHELL)
    declared = 'D:\\tools\\pwsh\\pwsh.exe'
    expect(result.pwshPath.get()).toBe('D:\\tools\\pwsh\\pwsh.exe')
  })

  it('adapts only the exact Electron-hosted win32 ACL runner argv', () => {
    const env = Object.freeze({ KEEP: 'value' })
    const spec = Object.freeze(shellSpec(env))
    const argv = Object.freeze([
      adaptation.execPath,
      adaptation.upstreamRunner,
      '--workspace',
      'C:\\workspace',
      '--',
      'powershell.exe',
      '-Command',
      'Write-Output ok',
    ])

    const result = adaptWindowsAclExecution(spec, argv, adaptation)

    expect(result.spec).not.toBe(spec)
    expect(result.argv).toEqual([
      adaptation.execPath,
      adaptation.trampoline,
      adaptation.upstreamRunner,
      '--workspace',
      'C:\\workspace',
      '--',
      'powershell.exe',
      '-Command',
      'Write-Output ok',
    ])
    expect(result.spec.env).toEqual({
      KEEP: 'value',
      [RUN_AS_NODE]: '1',
    })
    expect(spec.env).toBe(env)
    expect(argv).toEqual([
      adaptation.execPath,
      adaptation.upstreamRunner,
      '--workspace',
      'C:\\workspace',
      '--',
      'powershell.exe',
      '-Command',
      'Write-Output ok',
    ])
  })

  it.each([
    ['non-Windows host', { platform: 'darwin' as const }],
    ['plain Node host', { electron: false }],
    ['different executable', { execPath: 'C:\\other\\electron.exe' }],
    ['different runner', { upstreamRunner: 'C:\\other\\runner.js' }],
  ])('leaves a %s invocation and its object identities unchanged', (_label, override) => {
    const spec = shellSpec({ KEEP: 'value' })
    const argv = [adaptation.execPath, adaptation.upstreamRunner, '--', 'powershell.exe']

    const result = adaptWindowsAclExecution(spec, argv, { ...adaptation, ...override })

    expect(result.spec).toBe(spec)
    expect(result.argv).toBe(argv)
    expect(result.spec.env).toEqual({ KEEP: 'value' })
  })

  it('leaves the danger-full-access direct PowerShell argv unchanged', () => {
    const spec = shellSpec({ KEEP: 'value' })
    const argv = [
      'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      'Write-Output ok',
    ]

    const result = adaptWindowsAclExecution(spec, argv, adaptation)

    expect(result).toEqual({ spec, argv })
    expect(result.spec).toBe(spec)
    expect(result.argv).toBe(argv)
    expect(result.spec.env).not.toHaveProperty(RUN_AS_NODE)
  })

  it('removes every inherited Node-mode key case-insensitively', () => {
    const spec = shellSpec({
      electron_run_as_node: 'legacy-value',
      KEEP: 'value',
    })
    const argv = [adaptation.execPath, adaptation.upstreamRunner, '--', 'powershell.exe']

    const result = adaptWindowsAclExecution(spec, argv, adaptation)

    expect(result.spec.env).toEqual({
      KEEP: 'value',
      [RUN_AS_NODE]: '1',
    })
    expect(spec.env).toEqual({
      electron_run_as_node: 'legacy-value',
      KEEP: 'value',
    })
  })

  it('puts Node-mode variables only on the adapted child spec', () => {
    const previousRunAsNode = process.env[RUN_AS_NODE]
    process.env[RUN_AS_NODE] = 'host-value'
    try {
      const spec = shellSpec({ KEEP: 'value' })
      const result = adaptWindowsAclExecution(
        spec,
        [adaptation.execPath, adaptation.upstreamRunner, '--', 'powershell.exe'],
        adaptation,
      )

      expect(result.spec.env?.[RUN_AS_NODE]).toBe('1')
      expect(spec.env).toEqual({ KEEP: 'value' })
      expect(process.env[RUN_AS_NODE]).toBe('host-value')
    } finally {
      if (previousRunAsNode === undefined) delete process.env[RUN_AS_NODE]
      else process.env[RUN_AS_NODE] = previousRunAsNode
    }
  })
})

describe('desktop Windows PowerShell sandbox executor', () => {
  class ExposedSandbox extends DesktopWindowsPwshSandbox {
    runArgv(spec: ShellExecSpec, argv: readonly string[]): Promise<ShellExecution> {
      return this.executeArgv(spec, argv)
    }

    runPrepare(
      spec: ShellExecSpec,
      prepare: (signal: AbortSignal) => Promise<readonly string[]>,
    ): Promise<ShellExecution> {
      return this.executeArgv(spec, prepare)
    }
  }

  function harness(): { executor: ExposedSandbox; specs: SubprocessSpawnSpec[] } {
    const specs: SubprocessSpawnSpec[] = []
    const ctx = new Context()
    ctx.provide('sandboxPolicy', { defaultMode: 'danger-full-access' })
    ctx.provide('subprocess', {
      spawn: (spec: SubprocessSpawnSpec): SubprocessHandle => {
        specs.push(spec)
        const emptyReader = { readFrom: () => ({ text: '', lossy: false, nextOffset: 0 }) }
        return {
          stdin: undefined,
          stdout: undefined,
          stderr: undefined,
          control: undefined,
          collected: { stdout: emptyReader, stderr: emptyReader },
          done: Promise.resolve({ exitCode: 0, signal: null }),
          terminate: () => {},
          waitForExit: async () => true,
        }
      },
    })
    return { executor: new ExposedSandbox(ctx, pwshConfig()), specs }
  }

  const versions: { electron?: string } = process.versions
  const originalElectron = versions.electron

  afterEach(() => {
    if (originalElectron === undefined) delete versions.electron
    else versions.electron = originalElectron
  })

  it.runIf(process.platform === 'win32')(
    'inserts the Node-mode trampoline for a confined argv before the spawn reads the environment',
    async () => {
      Object.defineProperty(process.versions, 'electron', { value: '43.4.0', configurable: true, writable: true })
      const { executor, specs } = harness()
      const upstreamRunner = fileURLToPath(import.meta.resolve('@deepseek-ai/dsh-sandbox-windows-acl/runner'))
      const trampoline = fileURLToPath(new URL('../src/windows-acl-runner.js', import.meta.url))
      const spec = shellSpec({ KEEP: 'value' })

      await executor.runPrepare(spec, async () => [process.execPath, upstreamRunner, '--', 'powershell.exe'])

      expect(specs).toHaveLength(1)
      expect(specs[0]?.argv).toEqual([process.execPath, trampoline, upstreamRunner, '--', 'powershell.exe'])
      expect(specs[0]?.env).toMatchObject({ KEEP: 'value', [RUN_AS_NODE]: '1' })
      expect(specs[0]?.cwd).toBe('C:\\workspace')
      expect(spec.env).toEqual({ KEEP: 'value' })
    },
  )

  it('passes a direct PowerShell argv through without Node-mode environment', async () => {
    const { executor, specs } = harness()
    const argv = [SYSTEM_POWERSHELL, '-NoLogo', '-NoProfile', '-NonInteractive', '-Command', 'Write-Output ok']

    await executor.runArgv(shellSpec({ KEEP: 'value' }), argv)

    expect(specs).toHaveLength(1)
    expect(specs[0]?.argv).toEqual(argv)
    expect(specs[0]?.env).not.toHaveProperty(RUN_AS_NODE)
  })
})

describe('Windows ACL runner trampoline', () => {
  const originalArgv = process.argv
  const originalExitCode = process.exitCode
  const originalRunAsNode = process.env[RUN_AS_NODE]
  const originalLowercaseRunAsNode = process.env.electron_run_as_node

  afterEach(() => {
    process.argv = originalArgv
    process.exitCode = originalExitCode
    if (originalRunAsNode === undefined) delete process.env[RUN_AS_NODE]
    else process.env[RUN_AS_NODE] = originalRunAsNode
    if (originalLowercaseRunAsNode === undefined) delete process.env.electron_run_as_node
    else process.env.electron_run_as_node = originalLowercaseRunAsNode
    vi.restoreAllMocks()
  })

  it('removes Node mode from the target environment before rejecting an unexpected runner', async () => {
    process.argv = [process.execPath, 'windows-acl-runner.js', 'unexpected-runner.js']
    process.env[RUN_AS_NODE] = '1'
    process.env.electron_run_as_node = 'legacy-value'
    const stderr = vi.spyOn(process.stderr, 'write')
      .mockImplementation((() => true) as typeof process.stderr.write)

    const runnerModule: string = '../src/windows-acl-runner.ts?unexpected-runner-test'
    await import(/* @vite-ignore */ runnerModule)
    await new Promise<void>(resolve => setImmediate(resolve))

    expect(process.env[RUN_AS_NODE]).toBeUndefined()
    expect(process.env.electron_run_as_node).toBeUndefined()
    expect(process.exitCode).toBe(127)
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining(
      'windows-acl-run: desktop trampoline: desktop trampoline received an unexpected ACL runner',
    ))
  })

})
