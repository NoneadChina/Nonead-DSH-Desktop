/** Next entry points reuse Stable/Beta's native packaging and credential boundaries. */
import { spawnSync } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { packageDirectory } from '../../dsh-plugin-desktop-beta/scripts/package-dir.mjs'
import { releaseMac } from '../../dsh-plugin-desktop-beta/scripts/release-mac.ts'
import { adaptMacReleaseEnvironment, assertMacReleaseReady, withoutMacReleaseSecrets } from '../../dsh-plugin-desktop-beta/scripts/release-preflight.ts'
import { packageMacSmoke } from '../../dsh-plugin-desktop-beta/scripts/package-mac.ts'
import { createWindowsPackageOptions, packageWindowsInstaller } from '../../dsh-plugin-desktop-beta/scripts/package-win.ts'
import { withoutLinuxSigningSecrets } from '../../dsh-plugin-desktop-beta/scripts/package-linux.ts'
import { prepareNextMacRuntime } from './mac-runtime.ts'
import { runNextPackagingCommand } from './packaging-command.ts'
import { expectedNextVersion, nextRuntimeBuildPaths, nextRuntimeTargets, prepareNextRuntime, primaryRuntimeDirectory, smokeNextRuntime, verifyNextRuntimeTree } from './prepare-runtime.ts'
import { signMacRuntime, withMacSigningIdentity } from './sign-runtime.ts'

const desktopRoot = fileURLToPath(new URL('..', import.meta.url))
const workspaceRoot = resolve(desktopRoot, '..')
const require = createRequire(import.meta.url)
const APP_ID = (JSON.parse(readFileSync(join(desktopRoot, 'package.json'), 'utf8')) as { build: { appId: string } }).build.appId

/**
 * Optional test-only build version for update drills.
 *
 * electron-builder merges `extraMetadata` before signing, so one value reaches
 * the packaged `package.json` (which the runtime and the updater's bundle check
 * read), `Info.plist` `CFBundleShortVersionString`/`CFBundleVersion`, and the
 * `${version}` artifact name. That produces an installable, correctly signed
 * release whose version differs from the source tree, without editing any
 * version declaration. Only the shapes the Next channel accepts are allowed: a
 * release version (`x.y.z`), or the legacy `x.y.z-next` / `x.y.z-next.N` marker.
 * The bundled interpreter payloads and the prepared archive payload record the
 * same version.
 */
// `DSH_NEXT_BUILD_VERSION` is the pre-rename spelling of the same drill override.
const TEST_BUILD_VERSION = process.env.DSH_NONEAD_BUILD_VERSION ?? process.env.DSH_NEXT_BUILD_VERSION
if (TEST_BUILD_VERSION !== undefined && !/^[0-9]+\.[0-9]+\.[0-9]+(?:-next(?:\.[0-9]+)?)?$/u.test(TEST_BUILD_VERSION)) {
  throw new Error(`DSH_NONEAD_BUILD_VERSION must be x.y.z, x.y.z-next or x.y.z-next.N; received ${TEST_BUILD_VERSION}`)
}
const buildVersion = expectedNextVersion(desktopRoot)
const run = (command: string, args: readonly string[], cwd: string, env: NodeJS.ProcessEnv): void => {
  // Windows resolves the CLI path with backslashes.
  const isBuilder = args.includes('electron-builder') || args.some(arg => arg.replaceAll('\\', '/').endsWith('electron-builder/cli.js'))
  // Beta skips electron-builder's dependency rebuild with npmRebuild=false. electron-builder honours
  // that flag before it calls beforeBuild, and only a beforeBuild answer makes it leave node_modules
  // to the prepared payload, so Next drops the flag: its beforeBuild hook declines the rebuild too.
  const withoutRebuildFlag = isBuilder ? args.filter(arg => arg !== '--config.npmRebuild=false') : args
  const forwarded = TEST_BUILD_VERSION !== undefined && isBuilder
    ? [...withoutRebuildFlag, `--config.extraMetadata.version=${TEST_BUILD_VERSION}`, `--config.buildVersion=${TEST_BUILD_VERSION}`]
    : withoutRebuildFlag
  if (TEST_BUILD_VERSION !== undefined && isBuilder) console.log(`Packaging with test build version ${TEST_BUILD_VERSION}; source manifests are unchanged.`)
  runNextPackagingCommand(command, forwarded, cwd, env, workspaceRoot)
}
const listCodeSigningIdentities = (env: NodeJS.ProcessEnv): string => {
  const result = spawnSync('security', ['find-identity', '-v', '-p', 'codesigning'], { env, encoding: 'utf8' })
  if (result.error || result.status !== 0) throw result.error ?? new Error('Signing identity discovery failed')
  return result.stdout
}

/**
 * Prepare every interpreter payload the platform ships, sign them when a release identity is given,
 * then check and execute the final bytes. electron-builder copies the tree as extra resources.
 */
async function prepareInterpreters(sign?: (runtimeRoot: string) => Promise<void>): Promise<void> {
  const root = await prepareNextRuntime({ desktopRoot, platform: process.platform, version: buildVersion })
  if (sign !== undefined) await sign(root)
  verifyNextRuntimeTree(root, process.platform, buildVersion)
  smokeNextRuntime(root, process.platform)
}
/**
 * Materialize and seal the payload electron-builder archives. A separate process keeps the
 * manifest transformer it borrows from electron-builder out of this entry point.
 * @param platform - Platform being packaged.
 */
const preparePayload = (platform: NodeJS.Platform): void => {
  const result = spawnSync(process.execPath, [join(desktopRoot, 'scripts', 'prepare-payload.ts'), '--platform', platform,
    ...(TEST_BUILD_VERSION === undefined ? [] : ['--version', TEST_BUILD_VERSION])], { cwd: desktopRoot, env: process.env, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`Next payload preparation exited with ${String(result.status)}`)
}
/**
 * The shared flows call this right before electron-builder: the interpreter payloads were prepared
 * before they started and must still verify, and the archive payload is prepared now.
 * @param platform - Platform being packaged; the shared flows package the host platform.
 */
const prepareRuntime = (platform: NodeJS.Platform = process.platform): void => {
  if (platform === 'darwin') prepareNextMacRuntime(desktopRoot)
  verifyNextRuntimeTree(nextRuntimeBuildPaths(desktopRoot).runtime, platform, buildVersion)
  preparePayload(platform)
}

/** CPUs every Linux release ships. */
const LINUX_ARCHES = ['x64', 'arm64'] as const

/** Artifact families every Linux release publishes. */
const LINUX_ARTIFACT_EXTENSIONS = ['AppImage', 'deb', 'rpm'] as const

/** CPU spellings Electron Builder puts into a Linux artifact name. */
const LINUX_ARTIFACT_ARCH = ['x86_64', 'amd64', 'arm64', 'aarch64'] as const

/**
 * Remove this version's Linux artifacts before packaging, so a failed run cannot be mistaken for
 * the artifacts the verification step reads.
 */
function removeStaleLinuxArtifacts(): void {
  for (const extension of LINUX_ARTIFACT_EXTENSIONS) {
    for (const arch of LINUX_ARTIFACT_ARCH) {
      rmSync(join(desktopRoot, 'dist', `Nonead-DSH-Desktop-${buildVersion}-${arch}.${extension}`), { force: true })
    }
  }
}

/**
 * Package the prepared payload as AppImage, Debian and RPM artifacts for both Linux CPUs.
 *
 * One Electron Builder run builds x64 and arm64 from the same prepared tree: every architecture-
 * specific dependency resolves to a `<platform>-<arch>` directory inside it, so both installers
 * archive identical `app.asar` bytes while each carries its own Electron runtime and installer
 * metadata. The flow is unsigned and disables certificate discovery; signing is a separate step.
 */
async function packageLinuxArtifacts(): Promise<void> {
  if (process.platform !== 'linux') throw new Error('Linux artifacts must be built on a native Linux host')
  if (process.arch !== 'x64' && process.arch !== 'arm64') {
    throw new Error(`Linux artifacts require an x64 or arm64 build host; received ${process.arch}`)
  }
  const cleanEnvironment = withoutLinuxSigningSecrets(process.env)
  console.log(`Building unsigned Linux ${LINUX_ARCHES.join('/')} AppImage, deb and rpm; signing is a separate release step.`)
  if (cleanEnvironment.DSH_PACKAGE_CHECK_ALREADY_RAN !== '1') {
    run('corepack', ['yarn', 'workspace', 'nonead-dsh-desktop', 'check:linux-package'], workspaceRoot, cleanEnvironment)
  }
  await prepareInterpreters()
  prepareRuntime('linux')
  removeStaleLinuxArtifacts()
  run(process.execPath, [require.resolve('electron-builder/cli.js'), '--linux', ...LINUX_ARTIFACT_EXTENSIONS, '--x64', '--arm64', '--publish', 'never'],
    desktopRoot, { ...cleanEnvironment, CSC_IDENTITY_AUTO_DISCOVERY: 'false' })
  run(process.execPath, [join(desktopRoot, 'scripts', 'verify-linux-artifacts.ts'), '--version', buildVersion], desktopRoot, cleanEnvironment)
}
const mode = process.argv[2]
const outputDir = join(desktopRoot, 'dist', mode === 'mac' ? 'mac-release' : 'mac-smoke')
const shared = { env: process.env, platform: process.platform, desktopRoot, outputDir,
  resetOutput: () => rmSync(outputDir, { force: true, recursive: true }), run, log: console.log, prepareRuntime }
if (mode === 'dir') {
  await prepareInterpreters()
  prepareRuntime()
  packageDirectory({ cwd: desktopRoot, electronBuilderCli: require.resolve('electron-builder/cli.js'), electronDistPath: join(dirname(require.resolve('electron/package.json')), 'dist') })
} else if (mode === 'mac') {
  // The preflight the shared release flow repeats; the payload signatures must carry the identity it selects.
  const releaseEnvironment = adaptMacReleaseEnvironment(process.env)
  const ready = assertMacReleaseReady({ env: releaseEnvironment, platform: process.platform,
    listCodeSigningIdentities: () => listCodeSigningIdentities(withoutMacReleaseSecrets(releaseEnvironment)) })
  await prepareInterpreters(root => withMacSigningIdentity(releaseEnvironment, ready.identity, async (signer) => {
    for (const { arch } of nextRuntimeTargets('darwin')) {
      const signed = await signMacRuntime(primaryRuntimeDirectory(root, arch), APP_ID, signer, arch)
      console.log(`Signed ${String(signed)} native files of the ${arch} primary runtime as ${ready.identity}`)
    }
  }))
  releaseMac({ ...shared, listCodeSigningIdentities })
} else if (mode === 'mac-smoke') {
  await prepareInterpreters()
  packageMacSmoke({ ...shared, workspaceRoot, arch: process.arch, nodeVersion: process.versions.node,
    builderCli: require.resolve('electron-builder/cli.js'), verifier: join(desktopRoot, 'scripts/verify-mac-smoke.ts'), nodeExecutable: process.execPath })
} else if (mode === 'win') {
  await prepareInterpreters()
  packageWindowsInstaller({ ...createWindowsPackageOptions(), desktopRoot, workspaceRoot, run, prepareRuntime,
    verifier: join(desktopRoot, 'scripts/verify-win-installer.ts') })
} else if (mode === 'linux') {
  await packageLinuxArtifacts()
} else throw new Error('Expected dir, mac, mac-smoke, win or linux')
