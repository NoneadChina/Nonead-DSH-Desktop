/** Verify the unsigned Windows portable ZIP archive. */

import { readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import AdmZip from 'adm-zip'
import type { WindowsTargetArch } from './package-win.ts'
import { assertPortableExecutableBuffer } from './verify-win-installer.ts'

export interface WindowsPortableVerificationOptions {
  /** Desktop package root containing package.json and dist. */
  readonly desktopRoot: string
  /** Product version embedded in the expected artifact name. */
  readonly version: string
  /** Windows CPU the archive was built for. */
  readonly arch: WindowsTargetArch
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

function defaultOptions(): WindowsPortableVerificationOptions {
  const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const requested = process.env.DSH_PACKAGE_ARCH ?? 'x64'
  if (requested !== 'x64' && requested !== 'arm64') {
    throw new Error(`DSH_PACKAGE_ARCH must be x64 or arm64; received ${requested}`)
  }
  return { desktopRoot, version: readVersion(desktopRoot), arch: requested }
}

/** Verify the exact versioned portable archive and its application entry. */
export function verifyWindowsPortable(
  options: WindowsPortableVerificationOptions = defaultOptions(),
): string {
  const portablePath = join(
    options.desktopRoot,
    'dist',
    `DSH-Desktop-Beta-${options.version}-${options.arch}-Portable.zip`,
  )
  const stat = statSync(portablePath)
  if (!stat.isFile() || stat.size === 0) {
    throw new Error(`Windows portable archive is not a non-empty regular file: ${portablePath}`)
  }
  const archive = new AdmZip(portablePath)
  const entries = archive.getEntries().filter(entry => !entry.isDirectory)
  const executable = entries.find(entry => entry.entryName.replaceAll('\\', '/') === 'DSH Desktop Beta.exe')
  if (executable === undefined) {
    throw new Error(`Windows portable archive is missing DSH Desktop Beta.exe: ${portablePath}`)
  }
  if (!entries.some(entry => entry.entryName.replaceAll('\\', '/') === 'resources/app/package.json')) {
    throw new Error(`Windows portable archive is missing resources/app/package.json: ${portablePath}`)
  }
  assertPortableExecutableBuffer(
    executable.getData(),
    'Windows portable application',
    `${portablePath}:DSH Desktop Beta.exe`,
  )
  return portablePath
}

const invokedPath = process.argv[1]
if (invokedPath !== undefined && resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  try {
    console.log(`Windows portable verification passed: ${verifyWindowsPortable()}`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
