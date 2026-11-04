/** Build an unsigned Linux AppImage and Debian package on a native Linux host (x64 or arm64). */

import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { prepareFsExtForElectron } from './prepare-fs-ext.ts'
import { electronBuilderEnvironment } from './electron-builder-environment.ts'
import { prepareDesktopInterpreters, verifyPreparedDesktopRuntime } from './prepare-runtime.ts'

/** Architectures a native Linux host may package for. */
export type LinuxTargetArch = 'arm64' | 'x64'

const LINUX_TARGET_ARCHES = new Set<string>(['arm64', 'x64'])

/**
 * Normalize the packaging architecture.
 *
 * The Linux package builds `fs-ext` with node-gyp, which cannot cross-compile, so the target is
 * always the host architecture; unsupported architectures fail instead of producing a broken
 * AppImage.
 * @param arch - `process.arch` of the packaging host.
 * @returns the supported target architecture.
 */
export function normalizeLinuxArch(arch: string): LinuxTargetArch {
  if (!LINUX_TARGET_ARCHES.has(arch)) {
    throw new Error(`Linux artifacts require an x64 or arm64 host; received ${arch}`)
  }
  return arch as LinuxTargetArch
}

const LINUX_SIGNING_KEYS = [
  'CSC_IDENTITY_AUTO_DISCOVERY',
  'CSC_KEY_PASSWORD',
  'CSC_LINK',
  'CSC_NAME',
] as const

/** Injectable native Linux packaging boundary used by focused tests. */
export interface LinuxPackageOptions {
  /** Environment inherited by the packaging command. */
  readonly env: NodeJS.ProcessEnv
  /** Platform executing the package build. */
  readonly platform: NodeJS.Platform
  /** Node architecture executing the package build. */
  readonly arch: string
  /** Node version executing the package build. */
  readonly nodeVersion: string
  /** Repository root containing the Yarn workspace. */
  readonly workspaceRoot: string
  /** Desktop package root containing electron-builder configuration. */
  readonly desktopRoot: string
  /** Absolute electron-builder CLI module. */
  readonly builderCli: string
  /** Prepare platform-specific native runtime dependencies before packaging. */
  readonly prepareRuntime: () => void
  /** Absolute packaged-artifact verification script. */
  readonly verifier: string
  /** Node executable used to run package-local scripts. */
  readonly nodeExecutable: string
  /** Execute one packaging command. */
  readonly run: (
    command: string,
    args: readonly string[],
    cwd: string,
    env: NodeJS.ProcessEnv,
  ) => void
  /** Report non-secret packaging progress. */
  readonly log: (message: string) => void
}

/**
 * Remove all certificate discovery and secret variables from an unsigned build.
 * @param environment - Environment that may contain Linux signing configuration.
 * @returns A copy suitable for checks and unsigned packaging.
 */
export function withoutLinuxSigningSecrets(
  environment: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  const sanitized = { ...environment }
  const signingKeys = new Set<string>(LINUX_SIGNING_KEYS)
  for (const key of Object.keys(sanitized)) {
    if (signingKeys.has(key.toUpperCase())) delete sanitized[key]
  }
  return sanitized
}

function run(
  command: string,
  args: readonly string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
): void {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' })
  if (result.error !== undefined) throw result.error
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited with ${String(result.status)}`)
  }
}

/** Create the native packaging options for a verifier entry point. */
export function createLinuxPackageOptions(verifier = './verify-linux-artifacts.ts'): LinuxPackageOptions {
  const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const workspaceRoot = resolve(desktopRoot, '..')
  const require = createRequire(import.meta.url)
  const arch = normalizeLinuxArch(process.arch)
  return {
    env: process.env,
    platform: process.platform,
    arch,
    nodeVersion: process.versions.node,
    workspaceRoot,
    desktopRoot,
    builderCli: require.resolve('electron-builder/cli.js'),
    prepareRuntime: () => {
      prepareFsExtForElectron({ platform: 'linux', arch, desktopRoot })
      // Linux ships no interpreter payload; the check confirms the tree declares none.
      verifyPreparedDesktopRuntime(desktopRoot, 'linux')
    },
    verifier: fileURLToPath(new URL(verifier, import.meta.url)),
    nodeExecutable: process.execPath,
    run,
    log: message => console.log(message),
  }
}

/** Run the shared host and Node release gates before packaging. */
function assertLinuxPackageHost(options: LinuxPackageOptions): void {
  if (options.platform !== 'linux') {
    throw new Error('Linux artifacts must be built on a native Linux host')
  }
  if (options.arch !== 'x64' && options.arch !== 'arm64') {
    throw new Error(`Linux artifacts require an x64 or arm64 host; received ${options.arch}`)
  }
  if (options.arch !== process.arch) {
    // `fs-ext` is compiled by node-gyp for the host, so a mismatched target would ship a binding
    // the package cannot load.
    throw new Error(
      `Linux ${options.arch} artifacts must be built on that architecture; this host is ${process.arch}`,
    )
  }
  const versionMatch = /^(\d+)\.(\d+)\./u.exec(options.nodeVersion)
  const major = Number(versionMatch?.[1])
  const minor = Number(versionMatch?.[2])
  if (!((major === 22 && minor >= 19) || major === 24)) {
    throw new Error(
      `Linux artifacts require Node 22.19+ or Node 24.x with bundled Corepack; received ${options.nodeVersion}`,
    )
  }
}

/** Run the gates and package the unsigned Linux AppImage and Debian package for the host architecture. */
export function packageLinuxArtifacts(
  options: LinuxPackageOptions = createLinuxPackageOptions(),
): void {
  assertLinuxPackageHost(options)

  const cleanEnvironment = withoutLinuxSigningSecrets(options.env)
  options.log(`Building unsigned Linux ${options.arch} AppImage and Debian package; signing is a separate release step.`)
  if (options.env.DSH_PACKAGE_CHECK_ALREADY_RAN !== '1') {
    options.run(
      'corepack',
      ['yarn', 'workspace', 'dsh-plugin-desktop-beta', 'check:linux-package'],
      options.workspaceRoot,
      cleanEnvironment,
    )
  } else {
    options.log('Skipping the Linux package preflight; the package gate already passed.')
  }
  options.prepareRuntime()
  options.run(
    options.nodeExecutable,
    [
      options.builderCli,
      '--linux',
      'AppImage',
      'deb',
      `--${options.arch}`,
      '--publish',
      'never',
      '--config.npmRebuild=false',
    ],
    options.desktopRoot,
    electronBuilderEnvironment({
      ...cleanEnvironment,
      CSC_IDENTITY_AUTO_DISCOVERY: 'false',
    }),
  )
  options.run(
    options.nodeExecutable,
    [options.verifier],
    options.desktopRoot,
    cleanEnvironment,
  )
}

const invokedPath = process.argv[1]
if (invokedPath !== undefined && resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  try {
    await prepareDesktopInterpreters({ desktopRoot: resolve(dirname(fileURLToPath(import.meta.url)), '..') })
    packageLinuxArtifacts()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
