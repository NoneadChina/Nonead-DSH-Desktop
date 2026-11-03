/** Verify the unsigned Windows x64 NSIS installer and unpacked executable. */

import { closeSync, openSync, readFileSync, readSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { WindowsTargetArch } from './package-win.ts'

/** Verify a complete in-memory Windows PE image. */
export function assertPortableExecutableBuffer(data: Buffer, label: string, source: string): void {
  if (data.byteLength < 68 || data.subarray(0, 2).toString('ascii') !== 'MZ') {
    throw new Error(`${label} does not have a Windows PE header: ${source}`)
  }
  const peOffset = data.readUInt32LE(0x3c)
  if (peOffset > data.byteLength - 4) {
    throw new Error(`${label} has an invalid Windows PE offset: ${source}`)
  }
  if (!data.subarray(peOffset, peOffset + 4).equals(Buffer.from('PE\0\0'))) {
    throw new Error(`${label} does not have a Windows PE signature: ${source}`)
  }
}

/** Paths returned after Windows installer verification succeeds. */
export interface WindowsInstallerArtifacts {
  /** NSIS installer path. */
  readonly installerPath: string
  /** Unpacked application executable path. */
  readonly applicationPath: string
}

/** Injectable Windows installer verification boundary. */
export interface WindowsInstallerVerificationOptions {
  /** Desktop package root containing package.json and dist. */
  readonly desktopRoot: string
  /** Product version embedded in the expected artifact name. */
  readonly version: string
  /** Windows CPU the artifacts were built for. */
  readonly arch: WindowsTargetArch
}

/** electron-builder's per-CPU artifact token and unpacked directory. */
const ARCH_LAYOUT: Record<WindowsTargetArch, { readonly token: string, readonly unpacked: string }> = {
  x64: { token: 'x64', unpacked: 'win-unpacked' },
  arm64: { token: 'arm64', unpacked: 'win-arm64-unpacked' },
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

/** Verify that a generated Windows artifact has a valid PE header. */
export function assertPortableExecutable(path: string, label: string): void {
  const stat = statSync(path)
  if (!stat.isFile() || stat.size < 68) {
    throw new Error(`${label} is not a non-empty regular file: ${path}`)
  }
  const descriptor = openSync(path, 'r')
  const dosHeader = Buffer.alloc(64)
  try {
    const dosBytesRead = readSync(descriptor, dosHeader, 0, dosHeader.byteLength, 0)
    if (dosBytesRead !== dosHeader.byteLength || dosHeader.subarray(0, 2).toString('ascii') !== 'MZ') {
      throw new Error(`${label} does not have a Windows PE header: ${path}`)
    }
    const peOffset = dosHeader.readUInt32LE(0x3c)
    if (peOffset > stat.size - 4) {
      throw new Error(`${label} has an invalid Windows PE offset: ${path}`)
    }
    const signature = Buffer.alloc(4)
    const signatureBytesRead = readSync(descriptor, signature, 0, signature.byteLength, peOffset)
    if (signatureBytesRead !== signature.byteLength || !signature.equals(Buffer.from('PE\0\0'))) {
      throw new Error(`${label} does not have a Windows PE signature: ${path}`)
    }
  } finally {
    closeSync(descriptor)
  }
}

function defaultOptions(): WindowsInstallerVerificationOptions {
  const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const requested = process.env.DSH_PACKAGE_ARCH ?? 'x64'
  if (requested !== 'x64' && requested !== 'arm64') {
    throw new Error(`DSH_PACKAGE_ARCH must be x64 or arm64; received ${requested}`)
  }
  return {
    desktopRoot,
    version: readVersion(desktopRoot),
    arch: requested,
  }
}

/**
 * Verify the exact NSIS installer and unpacked application executable.
 * @param options - Artifact root and expected product version.
 * @returns The verified artifact paths.
 */
export function verifyWindowsInstaller(
  options: WindowsInstallerVerificationOptions = defaultOptions(),
): WindowsInstallerArtifacts {
  const distDir = join(options.desktopRoot, 'dist')
  const layout = ARCH_LAYOUT[options.arch]
  const installerPath = join(
    distDir,
    `DSH-Desktop-Beta-${options.version}-${layout.token}-Setup.exe`,
  )
  const applicationPath = join(distDir, layout.unpacked, 'DSH Desktop Beta.exe')

  assertPortableExecutable(installerPath, 'Windows NSIS installer')
  assertPortableExecutable(applicationPath, 'unpacked Windows application')
  return { installerPath, applicationPath }
}

const invokedPath = process.argv[1]
if (invokedPath !== undefined && resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  try {
    const verified = verifyWindowsInstaller()
    console.log(`Windows installer verification passed: ${verified.installerPath}`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
