/** Verify every final Next executable: fuses, the sealed archive, a RunAsNode import smoke and a real Host boot. */
import { closeSync, existsSync, mkdirSync, openSync, readSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifyElectronExecutableFuses } from '../../dsh-plugin-desktop-beta/scripts/verify-electron-fuses.ts'
import { withoutMacReleaseSecrets } from '../../dsh-plugin-desktop-beta/scripts/release-preflight.ts'
import { withoutWindowsSigningSecrets } from '../../dsh-plugin-desktop-beta/scripts/package-win.ts'
import { archivedPayload, nextPackagingTarget, PAYLOAD_DIR, universalMergeRewrite, verifyNextRuntime, verifyUpdaterManifestShim } from './packaged-payload.ts'
import { expectedNextVersion, verifyNextRuntimeTree } from './prepare-runtime.ts'

const desktopRoot = fileURLToPath(new URL('..', import.meta.url))

/** COFF machine identifiers of the CPUs the Windows payload can target. */
const PE_MACHINES = { x64: 0x8664, arm64: 0xaa64 } as const

/** ELF `e_machine` values of the CPUs the Linux payload can target. */
const ELF_MACHINES = { x64: 62, arm64: 183 } as const

function runPackagedNode(path: string, args: readonly string[], timeout: number, failure: string): void {
  const result = spawnSync(path, args, {
    env: { ...withoutWindowsSigningSecrets(withoutMacReleaseSecrets(process.env)), ELECTRON_RUN_AS_NODE: '1' },
    timeout, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.error || result.status !== 0) {
    throw result.error ?? new Error(`${failure}: exit ${String(result.status)} signal ${String(result.signal)}\n${result.stderr}`)
  }
}

/** Read the COFF machine type of one Windows executable without loading it. */
function peMachine(path: string): number {
  const descriptor = openSync(path, 'r')
  try {
    const dos = Buffer.alloc(64)
    if (readSync(descriptor, dos, 0, dos.byteLength, 0) !== dos.byteLength || dos.subarray(0, 2).toString('ascii') !== 'MZ') {
      throw new Error(`No Windows PE header in ${path}`)
    }
    const offset = dos.readUInt32LE(0x3c)
    const coff = Buffer.alloc(6)
    if (readSync(descriptor, coff, 0, coff.byteLength, offset) !== coff.byteLength
      || !coff.subarray(0, 4).equals(Buffer.from([0x50, 0x45, 0x00, 0x00]))) {
      throw new Error(`No Windows PE signature in ${path}`)
    }
    return coff.readUInt16LE(4)
  } finally {
    closeSync(descriptor)
  }
}

/** Read the ELF machine type of one Linux executable without loading it. */
function elfMachine(path: string): number {
  const descriptor = openSync(path, 'r')
  try {
    const header = Buffer.alloc(20)
    if (readSync(descriptor, header, 0, header.byteLength, 0) !== header.byteLength
      || !header.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))) {
      throw new Error(`No ELF header in ${path}`)
    }
    return header.readUInt16LE(18)
  } finally {
    closeSync(descriptor)
  }
}

/**
 * The platform and CPU one packaged tree was built for.
 *
 * electron-builder names the CPU in the output directory (`linux-unpacked`, `linux-arm64-unpacked`,
 * `win-arm64-unpacked`), so a batch that holds both CPUs is verified against each tree's own
 * target instead of the host's default architecture.
 * @param path - Packaged executable path inside `outDir`.
 * @returns Platform and architecture the tree must declare.
 */
function packagedTarget(path: string): ReturnType<typeof nextPackagingTarget> {
  if (path.includes('.app/')) return nextPackagingTarget('darwin')
  const platform: NodeJS.Platform = path.endsWith('.exe') ? 'win32' : 'linux'
  return { platform, archs: [path.includes('-arm64-unpacked') ? 'arm64' : 'x64'] }
}

/** Verify one packaged executable end to end. */
async function verifyExecutable(path: string, expectedVersion: string): Promise<void> {
  // The stable shell ships an archive: assert the hardened fuse table, including the archive
  // fuse that keeps Electron from loading a replaced physical `app/` tree beside `app.asar`.
  await verifyElectronExecutableFuses(path, undefined, true)
  const darwin = path.includes('.app/')
  const resources = darwin ? join(dirname(path), '../Resources') : join(dirname(path), 'resources')
  const root = join(resources, 'app.asar')
  // electron-builder signs unpacked Mach-O files and nested bundles after afterPack cross-checked
  // the archive, so the final tree is checked against the descriptor it carries with code-signing
  // tolerance; verify-mac-release.ts validates the signatures themselves.
  const target = packagedTarget(path)
  const merge = universalMergeRewrite(join(desktopRoot, ...PAYLOAD_DIR.split('/')))
  const descriptor = verifyNextRuntime(resources, expectedVersion, target, { afterCodeSigning: true, acceptRewrite: merge.accept })
  console.log(`Verified ${root} against its sealed descriptor: ${String(descriptor.files.length)} files, dsh ${descriptor.release.dshVersion}`
    + (merge.accepted.length === 0 ? '' : `; the universal merge rewrote ${merge.accepted.join(', ')}`))
  // The manifest copy for the updaters of earlier releases must have come through signing and the merge unchanged.
  const archived = archivedPayload(resources)
  try { verifyUpdaterManifestShim(resources, archived, target.platform, expectedVersion) } finally { archived.close() }
  // The interpreter payloads are pre-signed resources; code signing must have left them as prepared.
  const runtimes = verifyNextRuntimeTree(join(resources, 'runtime'), target.platform, expectedVersion)
  if (runtimes.length > 0) console.log(`Verified the bundled primary runtimes: ${runtimes.map(runtime => runtime.arch).join(', ')}`)
  // A cross-arch artifact (an arm64 installer built on this x64 host) is inspected but never run:
  // this host cannot execute it, and the failure would say nothing about the payload itself.
  const hostMachine = process.arch === 'arm64' ? PE_MACHINES.arm64 : PE_MACHINES.x64
  if (path.endsWith('.exe') && peMachine(path) !== hostMachine) {
    console.log(`Skipped the packaged runtime smokes for ${path}: it does not run on this ${process.arch} host`)
    return
  }
  // A Linux artifact for the other CPU is cross-arch for the same reason: ELF records its machine
  // type, so an aarch64 build is inspected on this x64 host instead of being spawned.
  const hostElf = process.arch === 'arm64' ? ELF_MACHINES.arm64 : ELF_MACHINES.x64
  if (!darwin && !path.endsWith('.exe') && elfMachine(path) !== hostElf) {
    console.log(`Skipped the packaged runtime smokes for ${path}: it does not run on this ${process.arch} host`)
    return
  }
  // Electron's Node mode reads the archive like a directory, as the Host and CLI will.
  runPackagedNode(path, ['--input-type=module', '-e', `
      import { createRequire } from 'node:module';
      import { pathToFileURL } from 'node:url';
      const root = process.argv[1];
      const require = createRequire(root + '/package.json');
      if (require('./package.json').name !== 'nonead-dsh-desktop') throw new Error('Wrong packaged application');
      await import(pathToFileURL(root + '/lib/profiles.js'));
      await import(pathToFileURL(root + '/lib/desktop-runtime.js'));
      require.resolve('@deepseek-ai/dsh-web-frontend/dist/index.html');
    `, root], 30_000, 'Packaged Next runtime failed')
  // The native computer-use driver opens its library with the system loader; the Host's resolver must answer with the unpacked copy.
  runPackagedNode(path, [join(desktopRoot, 'scripts', 'packaged-driver-smoke.mjs'), root], 120_000, 'Packaged computer-use driver smoke failed')
  // The badge skill announces its asset directory to the model; the Host's resolver must make it physical.
  runPackagedNode(path, [join(desktopRoot, 'scripts', 'packaged-skill-badge-smoke.mjs'), root], 120_000, 'Packaged badge skill smoke failed')
  // The same Electron, in Node mode, starts the real Host from the archive with a private home.
  runPackagedNode(path, ['--expose-internals', join(desktopRoot, 'scripts', 'packaged-host-smoke.mjs'), root], 300_000, 'Packaged Next Host smoke failed')
}

export default async function afterAllArtifactBuild(result: { outDir: string }): Promise<string[]> {
  const paths = ['mac/Nonead DSH Desktop.app/Contents/MacOS/Nonead DSH Desktop', 'mac-arm64/Nonead DSH Desktop.app/Contents/MacOS/Nonead DSH Desktop',
    'mac-universal/Nonead DSH Desktop.app/Contents/MacOS/Nonead DSH Desktop', 'win-unpacked/Nonead DSH Desktop.exe',
    'win-arm64-unpacked/Nonead DSH Desktop.exe', 'linux-unpacked/nonead-dsh-desktop',
    'linux-arm64-unpacked/nonead-dsh-desktop']
  const executables = paths.map(path => join(result.outDir, path)).filter(existsSync)
  if (!executables.length) throw new Error('No packaged Next executable to verify')
  const expectedVersion = expectedNextVersion(desktopRoot)
  // Electron's packaged Node cannot create directories under %TEMP% on this host: `mkdtemp` and
  // `mkdir` both fail with EPERM from inside the Electron process while plain Node succeeds.
  // Hand the packaged Host smoke a workspace scratch root instead of weakening the check.
  const scratch = join(desktopRoot, `.tmp-packaged-smoke-${String(process.pid)}-${String(Date.now())}`)
  mkdirSync(scratch, { recursive: true })
  const previousTemp = process.env.TEMP
  const previousTmp = process.env.TMP
  process.env.DSH_PACKAGED_SMOKE_SCRATCH = scratch
  // The packaged Electron runs at low integrity on this host and cannot create directories under
  // the system TEMP; point both variables at the workspace scratch so plugins that need a private
  // temp root can still start while the smoke exercises the real payload.
  process.env.TEMP = scratch
  process.env.TMP = scratch
  try {
    for (const path of executables) await verifyExecutable(path, expectedVersion)
  } finally {
    delete process.env.DSH_PACKAGED_SMOKE_SCRATCH
    if (previousTemp === undefined) delete process.env.TEMP
    else process.env.TEMP = previousTemp
    if (previousTmp === undefined) delete process.env.TMP
    else process.env.TMP = previousTmp
    rmSync(scratch, { recursive: true, force: true })
  }
  return []
}
