/** Verify the unsigned Linux AppImage and deb artifacts plus the unpacked executable. */

import { closeSync, openSync, readFileSync, readSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { LinuxTargetArch } from './package-linux.ts'
import { linuxTargetArch } from './package-linux.ts'

const ELF_HEADER_BYTES = 4
const ELF_MACHINE_OFFSET = 18
const ELF_MACHINE_BYTES = 2
const APPIMAGE_MAGIC_OFFSET = 8
const APPIMAGE_MAGIC_BYTES = 3
const DEB_MEMBER_HEADER_BYTES = 60

/** ELF `e_machine` values for the CPUs this path can emit. */
const ELF_MACHINES: Record<LinuxTargetArch, number> = {
  x64: 0x3e,
  arm64: 0xb7,
}

/** electron-builder's per-CPU artifact names and unpacked directory. */
interface LinuxArtifactNames {
  /** Debian CPU token (`amd64`/`arm64`). */
  readonly debArch: string
  /** AppImage CPU token (`x86_64`/`aarch64`). */
  readonly appImageArch: string
  /** Unpacked directory name. */
  readonly unpackedDir: string
}

const ARTIFACT_NAMES: Record<LinuxTargetArch, LinuxArtifactNames> = {
  x64: { appImageArch: 'x86_64', debArch: 'amd64', unpackedDir: 'linux-unpacked' },
  arm64: { appImageArch: 'aarch64', debArch: 'arm64', unpackedDir: 'linux-arm64-unpacked' },
}

/** Paths returned after Linux artifact verification succeeds. */
export interface LinuxArtifacts {
  /** AppImage distribution path. */
  readonly appImagePath: string
  /** Debian package path. */
  readonly debPath: string
  /** Unpacked application executable path. */
  readonly applicationPath: string
}

/** Injectable Linux artifact verification boundary. */
export interface LinuxArtifactVerificationOptions {
  /** Desktop package root containing package.json and dist. */
  readonly desktopRoot: string
  /** Product version embedded in the expected artifact names. */
  readonly version: string
  /** Linux CPU the artifacts were built for. */
  readonly arch: LinuxTargetArch
}

function readVersion(desktopRoot: string): string {
  const manifest = JSON.parse(readFileSync(join(desktopRoot, 'package.json'), 'utf8')) as {
    version?: unknown
  }
  if (typeof manifest.version !== 'string' || manifest.version.length === 0) {
    throw new Error(`desktop package at ${desktopRoot} has no valid version`)
  }
  return manifest.version
}

/**
 * Verify that a generated file is a non-empty regular ELF executable.
 *
 * When an expected CPU is supplied the ELF `e_machine` must match it: a
 * cross-arch build cannot execute the artifact, so the header is the only proof
 * that electron-builder emitted the requested CPU.
 * @param path - Artifact path to probe.
 * @param label - Human-readable role used in failure messages.
 * @param expectedArch - CPU the artifact must target, or `undefined` to skip the check.
 */
export function assertElfExecutable(
  path: string,
  label: string,
  expectedArch?: LinuxTargetArch,
): void {
  const stat = statSync(path)
  if (!stat.isFile() || stat.size < ELF_HEADER_BYTES + APPIMAGE_MAGIC_OFFSET) {
    throw new Error(`${label} is not a non-empty regular file: ${path}`)
  }
  if ((stat.mode & 0o111) === 0) {
    throw new Error(`${label} is not executable: ${path}`)
  }
  const descriptor = openSync(path, 'r')
  const header = Buffer.alloc(ELF_HEADER_BYTES)
  try {
    if (readSync(descriptor, header, 0, ELF_HEADER_BYTES, 0) !== ELF_HEADER_BYTES
      || header[0] !== 0x7f || header.subarray(1, 4).toString('ascii') !== 'ELF') {
      throw new Error(`${label} does not have an ELF header: ${path}`)
    }
    if (expectedArch === undefined) return
    const machine = Buffer.alloc(ELF_MACHINE_BYTES)
    if (readSync(descriptor, machine, 0, ELF_MACHINE_BYTES, ELF_MACHINE_OFFSET) !== ELF_MACHINE_BYTES) {
      throw new Error(`${label} does not declare an ELF machine: ${path}`)
    }
    const actual = machine.readUInt16LE(0)
    const expected = ELF_MACHINES[expectedArch]
    if (actual !== expected) {
      throw new Error(
        `${label} targets ELF machine 0x${actual.toString(16)} but the build requested ${expectedArch} (0x${expected.toString(16)}): ${path}`,
      )
    }
  } finally {
    closeSync(descriptor)
  }
}

/**
 * Verify that a generated file is an AppImage: an ELF executable carrying the
 * AppImage type magic at offset 8.
 * @param path - Artifact path to probe.
 * @param label - Human-readable role used in failure messages.
 * @param expectedArch - CPU the artifact must target, or `undefined` to skip the check.
 */
export function assertAppImage(
  path: string,
  label: string,
  expectedArch?: LinuxTargetArch,
): void {
  assertElfExecutable(path, label, expectedArch)
  const descriptor = openSync(path, 'r')
  const magic = Buffer.alloc(APPIMAGE_MAGIC_BYTES)
  try {
    const bytesRead = readSync(descriptor, magic, 0, magic.byteLength, APPIMAGE_MAGIC_OFFSET)
    if (bytesRead !== APPIMAGE_MAGIC_BYTES || !magic.equals(Buffer.from([0x41, 0x49, 0x02]))) {
      throw new Error(`${label} does not have an AppImage magic: ${path}`)
    }
  } finally {
    closeSync(descriptor)
  }
}

/**
 * Verify that a generated file is a Debian binary package: an ar archive whose
 * first member is the mandatory debian-binary version marker.
 * @param path - Artifact path to probe.
 * @param label - Human-readable role used in failure messages.
 */
export function assertDebArchive(path: string, label: string): void {
  try {
    const stat = statSync(path)
    if (!stat.isFile() || stat.size < `!<arch>\n`.length + DEB_MEMBER_HEADER_BYTES) {
      throw new Error(`${label} is not a non-empty regular file: ${path}`)
    }
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error))
  }
  const descriptor = openSync(path, 'r')
  const header = Buffer.alloc(`!<arch>\n`.length + DEB_MEMBER_HEADER_BYTES)
  try {
    const bytesRead = readSync(descriptor, header, 0, header.byteLength, 0)
    if (bytesRead !== header.byteLength || header.subarray(0, `!<arch>\n`.length).toString('ascii') !== `!<arch>\n`) {
      throw new Error(`${label} does not have an ar archive header: ${path}`)
    }
    const memberName = header.subarray(`!<arch>\n`.length, `!<arch>\n`.length + 16).toString('ascii')
    if (!memberName.startsWith('debian-binary')) {
      throw new Error(`${label} does not start with debian-binary: ${path}`)
    }
  } finally {
    closeSync(descriptor)
  }
}

function defaultOptions(): LinuxArtifactVerificationOptions {
  const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  return {
    desktopRoot,
    version: readVersion(desktopRoot),
    arch: linuxTargetArch(process.env),
  }
}

/**
 * Verify the exact AppImage, Debian package, and unpacked application executable.
 * @param options - Artifact root, expected product version, and target CPU.
 * @returns The verified artifact paths.
 */
export function verifyLinuxArtifacts(
  options: LinuxArtifactVerificationOptions = defaultOptions(),
): LinuxArtifacts {
  const names = ARTIFACT_NAMES[options.arch]
  const distDir = join(options.desktopRoot, 'dist')
  const appImagePath = join(distDir, `DSH-Desktop-Beta-${options.version}-${names.appImageArch}.AppImage`)
  const debPath = join(distDir, `DSH-Desktop-Beta-${options.version}-${names.debArch}.deb`)
  const applicationPath = join(distDir, names.unpackedDir, 'dsh-desktop-beta')

  assertAppImage(appImagePath, 'Linux AppImage', options.arch)
  assertDebArchive(debPath, 'Linux Debian package')
  assertElfExecutable(applicationPath, 'unpacked Linux application', options.arch)
  return { appImagePath, debPath, applicationPath }
}

const invokedPath = process.argv[1]
if (invokedPath !== undefined && resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  try {
    const verified = verifyLinuxArtifacts()
    console.log(`Linux artifact verification passed: ${verified.appImagePath}, ${verified.debPath}`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
