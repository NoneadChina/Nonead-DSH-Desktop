/** Verify the unsigned Linux AppImage, Debian and RPM artifacts of both CPUs, plus their unpacked executables. */

import { spawnSync } from 'node:child_process'
import { closeSync, existsSync, openSync, readFileSync, readSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

/** CPU pair every Linux release ships. */
export const LINUX_ARCHES = ['x64', 'arm64'] as const

/** One CPU a Linux release targets. */
export type LinuxArch = (typeof LINUX_ARCHES)[number]

/** Target families a Linux release publishes. */
export const LINUX_TARGETS = ['AppImage', 'deb', 'rpm'] as const

/** One artifact family. */
export type LinuxTarget = (typeof LINUX_TARGETS)[number]

/**
 * The `${arch}` Electron Builder writes into an artifact name, per family: AppImage and rpm use
 * the RPM/GNU triplet, deb uses the Debian architecture name, and arm64 keeps its own spelling in
 * AppImage and deb (`getArtifactArchName`).
 */
const ARTIFACT_ARCH = {
  AppImage: { x64: 'x86_64', arm64: 'arm64' },
  deb: { x64: 'amd64', arm64: 'arm64' },
  rpm: { x64: 'x86_64', arm64: 'aarch64' },
} as const satisfies Record<LinuxTarget, Record<LinuxArch, string>>

/** Architecture fpm writes into a package's own metadata. */
const PACKAGE_ARCH = {
  AppImage: undefined,
  deb: { x64: 'amd64', arm64: 'arm64' },
  rpm: { x64: 'x86_64', arm64: 'aarch64' },
} as const satisfies Record<LinuxTarget, Record<LinuxArch, string> | undefined>

/** `e_machine` values of the CPUs the payload ships, keyed by nothing but the ELF header. */
const ELF_MACHINE: Readonly<Record<number, LinuxArch>> = { 62: 'x64', 183: 'arm64' }

const ELF_IDENT_BYTES = 20
const APPIMAGE_MAGIC_OFFSET = 8
const APPIMAGE_MAGIC = Buffer.from([0x41, 0x49, 0x02])
const APPIMAGE_MAGIC_BYTES = APPIMAGE_MAGIC.byteLength
const AR_MAGIC = '!<arch>\n'
const AR_HEADER_BYTES = 60
const TAR_BLOCK_BYTES = 512
const RPM_MAGIC = Buffer.from([0xed, 0xab, 0xee, 0xdb])
/** How much of an rpm the structural architecture fallback scans for its ARCH tag string. */
const RPM_HEADER_SCAN_BYTES = 1024 * 1024

/** One verified artifact. */
export interface VerifiedLinuxArtifact {
  /** Artifact family. */
  readonly target: LinuxTarget
  /** CPU the artifact was built for. */
  readonly arch: LinuxArch
  /** Absolute artifact path. */
  readonly path: string
  /** Architecture the package metadata declares, or the AppImage runtime's CPU. */
  readonly declaredArch: string
}

/** Injectable Linux artifact verification boundary. */
export interface LinuxArtifactVerificationOptions {
  /** Desktop package root containing package.json and dist. */
  readonly desktopRoot: string
  /** Product version embedded in the expected artifact names. */
  readonly version: string
  /** Install-relative name of the unpacked application executable. */
  readonly executableName: string
  /** Progress output. */
  readonly log?: (message: string) => void
}

function readVersion(desktopRoot: string): string {
  const manifest = JSON.parse(readFileSync(join(desktopRoot, 'package.json'), 'utf8')) as { version?: unknown }
  if (typeof manifest.version !== 'string' || manifest.version.length === 0) {
    throw new Error(`desktop package at ${desktopRoot} has no valid version`)
  }
  return manifest.version
}

function requireFile(path: string, label: string): void {
  if (!existsSync(path) || !statSync(path).isFile()) throw new Error(`${label} is missing: ${path}`)
}

/**
 * Read the ELF header of one file and return the CPU its code targets.
 *
 * This is the only check in the flow that proves the bytes themselves are the requested CPU: a
 * package's metadata can be relabelled, an ELF `e_machine` cannot.
 * @param path - File to probe.
 * @param label - Human-readable role used in failure messages.
 * @returns The CPU the ELF header declares.
 */
export function readElfArch(path: string, label: string): LinuxArch {
  const descriptor = openSync(path, 'r')
  const header = Buffer.alloc(ELF_IDENT_BYTES)
  try {
    if (readSync(descriptor, header, 0, header.byteLength, 0) !== header.byteLength) {
      throw new Error(`${label} is truncated: ${path}`)
    }
  } finally {
    closeSync(descriptor)
  }
  if (!header.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))) {
    throw new Error(`${label} does not have an ELF header: ${path}`)
  }
  const elfClass = header[4]
  const endianness = header[5]
  if (elfClass !== 2) throw new Error(`${label} is not a 64-bit ELF file: ${path}`)
  if (endianness !== 1 && endianness !== 2) throw new Error(`${label} declares no usable byte order: ${path}`)
  const machine = endianness === 1 ? header.readUInt16LE(18) : header.readUInt16BE(18)
  const arch = ELF_MACHINE[machine]
  if (arch === undefined) throw new Error(`${label} targets ELF machine ${String(machine)}, not x64 or arm64: ${path}`)
  return arch
}

/**
 * Assert one AppImage is an executable ELF image carrying the AppImage type magic of its CPU.
 * @param path - Artifact to probe.
 * @param arch - CPU it must target.
 */
export function assertAppImage(path: string, arch: LinuxArch): void {
  requireFile(path, `${arch} AppImage`)
  const stat = statSync(path)
  // A Windows host reports no POSIX execute bits for any file, so this assertion only carries
  // information where the artifact can actually be run and shipped from.
  if (process.platform !== 'win32' && (stat.mode & 0o111) === 0) throw new Error(`${arch} AppImage is not executable: ${path}`)
  const descriptor = openSync(path, 'r')
  const magic = Buffer.alloc(APPIMAGE_MAGIC_BYTES)
  try {
    if (readSync(descriptor, magic, 0, magic.byteLength, APPIMAGE_MAGIC_OFFSET) !== magic.byteLength || !magic.equals(APPIMAGE_MAGIC)) {
      throw new Error(`${arch} AppImage does not have an AppImage magic at offset ${String(APPIMAGE_MAGIC_OFFSET)}: ${path}`)
    }
  } finally {
    closeSync(descriptor)
  }
  const runtimeArch = readElfArch(path, `${arch} AppImage runtime`)
  if (runtimeArch !== arch) throw new Error(`${arch} AppImage runs an ${runtimeArch} runtime: ${path}`)
}

interface ArMember {
  readonly name: string
  readonly bytes: Buffer
}

/** Split a Unix ar archive into its members. */
function readArMembers(path: string): ArMember[] {
  const archive = readFileSync(path)
  if (archive.subarray(0, AR_MAGIC.length).toString('ascii') !== AR_MAGIC) {
    throw new Error(`Not an ar archive: ${path}`)
  }
  const members: ArMember[] = []
  let offset = AR_MAGIC.length
  while (offset + AR_HEADER_BYTES <= archive.byteLength) {
    const header = archive.subarray(offset, offset + AR_HEADER_BYTES)
    if (header.subarray(AR_HEADER_BYTES - 2).toString('ascii') !== '`\n') {
      throw new Error(`Truncated ar member header at ${String(offset)}: ${path}`)
    }
    const name = header.subarray(0, 16).toString('ascii').trim().replace(/\/+$/u, '')
    const size = Number.parseInt(header.subarray(48, 58).toString('ascii').trim(), 10)
    if (!Number.isFinite(size) || size < 0) throw new Error(`Invalid ar member size for ${name}: ${path}`)
    const start = offset + AR_HEADER_BYTES
    members.push({ name, bytes: archive.subarray(start, start + size) })
    offset = start + size + (size % 2)
  }
  return members
}

/** Decompress one tar stream using the format its member name declares. */
function decompressTar(name: string, bytes: Buffer, label: string): Buffer {
  if (name.endsWith('.tar')) return bytes
  if (name.endsWith('.tar.gz')) return gunzipSync(bytes)
  // Debian packaging permits xz/zstd control archives; Node decodes only gzip, so ask the CLI the
  // build host must already carry: fpm's rpm target requires xz, and zstd is optional for deb.
  const compression: readonly [string, readonly string[]] | undefined = name.endsWith('.tar.xz')
    ? ['xz', ['-dc']]
    : name.endsWith('.tar.zst') ? ['zstd', ['-dc']] : undefined
  if (compression === undefined) throw new Error(`${label} uses an unsupported control archive format: ${name}`)
  const [command, args] = compression
  const result = spawnSync(command, args, { input: bytes, maxBuffer: 64 * 1024 * 1024 })
  if (result.error !== undefined || result.status !== 0) {
    throw new Error(`${label} cannot decode ${name}: install ${command} on the packaging host`)
  }
  return result.stdout
}

/** Read one file out of a tar stream by exact member name. */
function readTarEntry(tar: Buffer, wanted: string, label: string): Buffer | undefined {
  let offset = 0
  while (offset + TAR_BLOCK_BYTES <= tar.byteLength) {
    const header = tar.subarray(offset, offset + TAR_BLOCK_BYTES)
    if (header.every(byte => byte === 0)) return undefined
    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/su, '')
    const sizeField = header.subarray(124, 136).toString('ascii').replace(/\0.*$/su, '').trim()
    const size = Number.parseInt(sizeField, 8)
    if (!Number.isFinite(size) || size < 0) throw new Error(`${label} has an invalid tar size for ${name}`)
    const dataStart = offset + TAR_BLOCK_BYTES
    if (name === wanted || name === `./${wanted}`) return tar.subarray(dataStart, dataStart + size)
    offset = dataStart + Math.ceil(size / TAR_BLOCK_BYTES) * TAR_BLOCK_BYTES
  }
  return undefined
}

/**
 * Read the `Architecture` field of one Debian package from its control member.
 *
 * `dpkg-deb` answers the same question, but the artifact has to be verified on hosts that do not
 * install it, so the archive is parsed directly.
 * @param path - Debian package.
 * @returns The declared architecture.
 */
export function readDebArchitecture(path: string): string {
  const control = readArMembers(path).find(member => member.name.startsWith('control.tar'))
  if (control === undefined) throw new Error(`Debian package carries no control archive: ${path}`)
  const tar = decompressTar(control.name, control.bytes, 'Debian control archive')
  const controlFile = readTarEntry(tar, 'control', 'Debian control archive')
  if (controlFile === undefined) throw new Error(`Debian control archive carries no control file: ${path}`)
  const architecture = /^Architecture:\s*(\S+)\s*$/mu.exec(controlFile.toString('utf8'))?.[1]
  if (architecture === undefined) throw new Error(`Debian control file declares no Architecture: ${path}`)
  return architecture
}

/**
 * Read the architecture one rpm declares.
 *
 * The authoritative answer comes from the rpm database tooling when the host has it (the build
 * installs it for fpm anyway). Otherwise the main header is scanned for its `ARCH` tag string,
 * which the format always stores uncompressed right after the magic.
 * @param path - RPM package.
 * @returns Declared architecture and which method produced it.
 */
export function readRpmArchitecture(path: string): { arch: string; source: 'rpm' | 'header' } {
  const query = spawnSync('rpm', ['-qp', '--queryformat', '%{ARCH}', path], { encoding: 'utf8' })
  if (query.error === undefined && query.status === 0 && query.stdout.trim() !== '') {
    return { arch: query.stdout.trim(), source: 'rpm' }
  }
  const descriptor = openSync(path, 'r')
  const scan = Buffer.alloc(RPM_HEADER_SCAN_BYTES)
  let read = 0
  try {
    read = readSync(descriptor, scan, 0, scan.byteLength, 0)
  } finally {
    closeSync(descriptor)
  }
  const header = scan.subarray(0, read)
  if (!header.subarray(0, RPM_MAGIC.byteLength).equals(RPM_MAGIC)) {
    throw new Error(`Not an rpm package: ${path}`)
  }
  for (const arch of ['aarch64', 'x86_64']) {
    if (header.includes(arch)) return { arch, source: 'header' }
  }
  throw new Error(`rpm package declares no architecture the header scan can find: ${path}`)
}

/** Expected artifact file name of one family and CPU. */
export function linuxArtifactName(version: string, target: LinuxTarget, arch: LinuxArch): string {
  return `Nonead-DSH-Desktop-${version}-${ARTIFACT_ARCH[target][arch]}.${target}`
}

/** Unpacked application directory candidates Electron Builder uses for one CPU. */
function unpackedCandidates(arch: LinuxArch): readonly string[] {
  return arch === 'x64' ? ['linux-unpacked', 'linux-x64-unpacked'] : ['linux-arm64-unpacked']
}

/**
 * Verify every Linux artifact the release publishes and the unpacked executable each one was
 * packaged from: both CPUs of AppImage, deb and rpm exist, carry the CPU they are named for, and
 * declare the architecture the distribution will install them as.
 * @param options - Artifact root, product version and install-relative executable name.
 * @returns The verified artifacts in target/CPU order.
 */
export function verifyLinuxArtifacts(options: LinuxArtifactVerificationOptions = defaultOptions()): VerifiedLinuxArtifact[] {
  const distDir = join(options.desktopRoot, 'dist')
  const log = options.log ?? (() => {})
  const verified: VerifiedLinuxArtifact[] = []
  for (const target of LINUX_TARGETS) {
    for (const arch of LINUX_ARCHES) {
      const path = join(distDir, linuxArtifactName(options.version, target, arch))
      requireFile(path, `${arch} ${target}`)
      if (statSync(path).size < 1024 * 1024) throw new Error(`${arch} ${target} is implausibly small: ${path}`)
      let declaredArch: string
      if (target === 'AppImage') {
        assertAppImage(path, arch)
        declaredArch = arch
      }
      else if (target === 'deb') {
        declaredArch = readDebArchitecture(path)
      }
      else {
        const rpm = readRpmArchitecture(path)
        declaredArch = rpm.arch
        log(`${arch} rpm architecture read from ${rpm.source === 'rpm' ? 'the rpm database tooling' : 'the package header'}`)
      }
      const expected = PACKAGE_ARCH[target]?.[arch]
      if (expected !== undefined && declaredArch !== expected) {
        throw new Error(`${arch} ${target} declares architecture ${declaredArch}, expected ${expected}: ${path}`)
      }
      verified.push({ target, arch, path, declaredArch })
      log(`Verified ${arch} ${target}: ${declaredArch} (${String(statSync(path).size)} bytes)`)
    }
  }
  for (const arch of LINUX_ARCHES) {
    const unpacked = unpackedCandidates(arch).map(name => join(distDir, name)).find(candidate => existsSync(candidate))
    if (unpacked === undefined) throw new Error(`No unpacked ${arch} application directory under ${distDir}`)
    const executable = join(unpacked, options.executableName)
    requireFile(executable, `${arch} unpacked application`)
    const elfArch = readElfArch(executable, `${arch} unpacked application`)
    if (elfArch !== arch) throw new Error(`The ${arch} unpacked application is an ${elfArch} binary: ${executable}`)
    log(`Verified the ${arch} unpacked application: ${executable}`)
  }
  return verified
}

/** Default verification options for the desktop package this script lives in. */
function defaultOptions(): LinuxArtifactVerificationOptions {
  const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  return {
    desktopRoot,
    version: readVersion(desktopRoot),
    executableName: 'nonead-dsh-desktop',
  }
}

const invokedPath = process.argv[1]
if (invokedPath !== undefined && resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({
      options: { version: { type: 'string' }, 'executable-name': { type: 'string' } },
      allowPositionals: false,
    })
    const verified = verifyLinuxArtifacts({
      ...defaultOptions(),
      ...(values.version === undefined ? {} : { version: values.version }),
      ...(values['executable-name'] === undefined ? {} : { executableName: values['executable-name'] }),
      log: message => console.log(message),
    })
    console.log(`Linux artifact verification passed: ${String(verified.length)} artifacts (${LINUX_ARCHES.join('/')} × ${LINUX_TARGETS.join('/')})`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
