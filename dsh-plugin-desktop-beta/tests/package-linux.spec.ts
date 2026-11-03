import { describe, expect, it, vi } from 'vitest'
import {
  linuxTargetArch,
  packageLinuxArtifacts,
  withoutLinuxSigningSecrets,
  type LinuxPackageOptions,
} from '../scripts/package-linux.ts'

function options(overrides: Partial<LinuxPackageOptions> = {}): LinuxPackageOptions {
  return {
    env: {},
    platform: 'linux',
    arch: 'x64',
    targetArch: 'x64',
    nodeVersion: '24.17.0',
    workspaceRoot: '/workspace',
    desktopRoot: '/workspace/dsh-plugin-desktop',
    builderCli: '/workspace/node_modules/electron-builder/cli.js',
    prepareRuntime: vi.fn(),
    verifier: '/workspace/dsh-plugin-desktop/scripts/verify-linux-artifacts.ts',
    nodeExecutable: '/node/bin/node',
    run: vi.fn(),
    log: () => {},
    ...overrides,
  }
}

describe('Linux packaging orchestration', () => {
  it('runs the preflight, the builder, and the verifier in order', () => {
    const run = vi.fn()
    const prepareRuntime = vi.fn()
    const order: string[] = []
    run.mockImplementation((_command, args) => { order.push(args.join(' ')) })

    packageLinuxArtifacts(options({ run, prepareRuntime }))

    expect(run).toHaveBeenCalledTimes(3)
    expect(order[0]).toBe('yarn workspace dsh-plugin-desktop-beta check:linux-package')
    expect(order[1]).toContain('--linux')
    expect(order[1]).toContain('AppImage')
    expect(order[1]).toContain('deb')
    expect(order[1]).toContain('--publish')
    expect(order[1]).toContain('never')
    expect(order[1]).toContain('--config.npmRebuild=false')
    expect(order[2]).toContain('verify-linux-artifacts.ts')
    expect(prepareRuntime).toHaveBeenCalledOnce()
  })

  it('skips the preflight when the package gate already ran', () => {
    const run = vi.fn()

    packageLinuxArtifacts(options({ run, env: { DSH_PACKAGE_CHECK_ALREADY_RAN: '1' } }))

    expect(run).toHaveBeenCalledTimes(2)
    expect(run.mock.calls[0]![1]!.join(' ')).not.toContain('check:linux-package')
  })

  it('stops at the first failing command', () => {
    const run = vi.fn()
    run.mockImplementationOnce(() => { throw new Error('gate failed') })

    expect(() => packageLinuxArtifacts(options({ run }))).toThrow('gate failed')
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('builds the unsigned artifact with signing discovery disabled', () => {
    const run = vi.fn()
    const seen: NodeJS.ProcessEnv[] = []
    run.mockImplementation((_command, _args, _cwd, env) => { seen.push(env) })

    packageLinuxArtifacts(options({
      run,
      env: {
        DSH_PACKAGE_CHECK_ALREADY_RAN: '1',
        CSC_IDENTITY_AUTO_DISCOVERY: 'true',
        CSC_LINK: 'file:///secret.p12',
        CSC_KEY_PASSWORD: 'secret',
      },
    }))

    for (const env of seen) {
      expect(env.CSC_IDENTITY_AUTO_DISCOVERY).not.toBe('true')
      expect(env.CSC_LINK).toBeUndefined()
      expect(env.CSC_KEY_PASSWORD).toBeUndefined()
    }
    // The builder command additionally pins discovery off explicitly.
    expect(seen[0]!.CSC_IDENTITY_AUTO_DISCOVERY).toBe('false')
  })

  it('rejects non-Linux hosts and non-x64 architectures', () => {
    expect(() => packageLinuxArtifacts(options({ platform: 'win32' })))
      .toThrow('must be built on a native Linux host')
    expect(() => packageLinuxArtifacts(options({ arch: 'arm64' })))
      .toThrow('require x64 Node')
    expect(() => packageLinuxArtifacts(options({ nodeVersion: '20.1.0' })))
      .toThrow('Node 22.19+ or Node 24.x')
  })

  it('selects the Linux CPU from a flag or the environment', () => {
    expect(linuxTargetArch({}, [])).toBe('x64')
    expect(linuxTargetArch({}, ['--arm64'])).toBe('arm64')
    expect(linuxTargetArch({ DSH_PACKAGE_ARCH: 'arm64' }, [])).toBe('arm64')
    // An explicit flag wins over a stale environment value.
    expect(linuxTargetArch({ DSH_PACKAGE_ARCH: 'arm64' }, ['--x64'])).toBe('x64')
    expect(() => linuxTargetArch({ DSH_PACKAGE_ARCH: 'riscv64' }, []))
      .toThrow('Linux target CPU must be one of x64, arm64')
  })

  it('packages an arm64 payload and hands the same CPU to the verifier', () => {
    const run = vi.fn()

    packageLinuxArtifacts(options({ run, targetArch: 'arm64' }))

    const builder = run.mock.calls[1]![1]!.join(' ')
    expect(builder).toContain('--arm64')
    expect(builder).not.toContain('--x64')
    expect(run.mock.calls[2]![3]).toMatchObject({ DSH_PACKAGE_ARCH: 'arm64' })
  })

  it('strips signing secrets case-insensitively', () => {
    expect(withoutLinuxSigningSecrets({
      csc_identity_auto_discovery: 'true',
      CSC_NAME: 'me',
      UNRELATED: 'keep',
    })).toEqual({ UNRELATED: 'keep' })
  })
})
