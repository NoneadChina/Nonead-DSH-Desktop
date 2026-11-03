/** Build an unsigned Linux AppImage and Debian package on a native Linux host. */

import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { prepareFsExtForElectron } from './prepare-fs-ext.ts'
import { electronBuilderEnvironment } from './electron-builder-environment.ts'
import { prepareDesktopInterpreters, verifyPreparedDesktopRuntime } from './prepare-runtime.ts'

const LINUX_SIGNING_KEYS = [
  'CSC_IDENTITY_AUTO_DISCOVERY',
  'CSC_KEY_PASSWORD',
  'CSC_LINK',
  'CSC_NAME',
] as const

/** Linux CPUs this packaging path can emit from one host run. */
export const LINUX_TARGET_ARCHES = ['x64', 'arm64'] as const

/** A Linux CPU electron-builder can package from an x64 Linux host. */
export type LinuxTargetArch = (typeof LINUX_TARGET_ARCHES)[number]

/**
 * Read the Linux target CPU from `--x64`/`--arm64` or `DSH_PACKAGE_ARCH`.
 *
 * The build host must stay x64: the packaging chain executes the packaged binaries to verify them,
 * and an x64 host cannot run arm64 code. `arm64` therefore produces an artifact this host can only
 * inspect through its magic/ELF headers, never run.
 * @param env - environment of the packaging process.
 * @param argv - command-line arguments; an explicit CPU flag wins over the environment.
 * @returns the requested CPU, `x64` when unset.
 * @throws When the value is not a supported Linux CPU.
 */
export function linuxTargetArch(
  env: NodeJS.ProcessEnv,
  argv: readonly string[] = process.argv.slice(2),
): LinuxTargetArch {
  const flag = argv.find(argument => argument === '--x64' || argument === '--arm64')
  const requested = flag === undefined ? env.DSH_PACKAGE_ARCH ?? 'x64' : flag.slice(2)
  if (!(LINUX_TARGET_ARCHES as readonly string[]).includes(requested)) {
    throw new Error(`Linux target CPU must be one of ${LINUX_TARGET_ARCHES.join(', ')}; received ${requested}`)
  }
  return requested as LinuxTargetArch
}

/** Injectable native Linux packaging boundary used by focused tests. */
export interface LinuxPackageOptions {
  /** Environment inherited by the packaging command. */
  readonly env: NodeJS.ProcessEnv
  /** Platform executing the package build. */
  readonly platform: NodeJS.Platform
  /** Node architecture executing the package build. */
  readonly arch: string
  /** Linux CPU the artifact is built for; a cross-arch artifact cannot be executed here. */
  readonly targetArch: LinuxTargetArch
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
  const targetArch = linuxTargetArch(process.env)
  return {
    env: process.env,
    platform: process.platform,
    arch: process.arch,
    targetArch,
    nodeVersion: process.versions.node,
    workspaceRoot,
    desktopRoot,
    builderCli: require.resolve('electron-builder/cli.js'),
    prepareRuntime: () => {
      // fs-ext is shipped inside the artifact, so it must match the artifact CPU.
      const binding = prepareFsExtForElectron({ platform: 'linux', arch: targetArch, desktopRoot })
      if (binding.status === 'not-required') {
        throw new Error('Linux artifacts require a prepared fs-ext binding; preparation reported not-required')
      }
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
  if (options.arch !== 'x64') {
    throw new Error(`Linux artifacts require x64 Node; received ${options.arch}`)
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

/** Run the gates and package one unsigned Linux AppImage and Debian package. */
export function packageLinuxArtifacts(
  options: LinuxPackageOptions = createLinuxPackageOptions(),
): void {
  assertLinuxPackageHost(options)

  const cleanEnvironment = withoutLinuxSigningSecrets(options.env)
  options.log(`Building unsigned Linux ${options.targetArch} AppImage and Debian package; signing is a separate release step.`)
  if (options.targetArch !== 'x64') {
    options.log(`Cross-arch build: this ${options.arch} host cannot execute the packaged ${options.targetArch} binaries, so only header-level verification runs.`)
  }
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
      `--${options.targetArch}`,
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
    // The verifier reads the same target CPU the build used.
    { ...cleanEnvironment, DSH_PACKAGE_ARCH: options.targetArch },
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
