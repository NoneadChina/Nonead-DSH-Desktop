/** Persist the Desktop data location outside the selected home so it survives relaunch. */
import { readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { privateDirectory, readPrivateFile } from './private-files.ts'
import { LEGACY, readPrivateFileWithLegacy } from './legacy-names.ts'

export function defaultDataDirectory(userHome = homedir()): string { return join(userHome, '.dsh') }

export function readDataDirectory(
  defaultHome: string,
  locationRoot = defaultHome,
  legacyLocationRoot = locationRoot,
): { home: string; error?: string } {
  try {
    // The anchor directory was renamed with the product, so the legacy file name
    // next to the new one and the legacy anchor directory are both accepted.
    const text = readPrivateFileWithLegacy(locationRoot, 'nonead-dsh-desktop-location.json', LEGACY.location)
      ?? (legacyLocationRoot === locationRoot ? undefined : readPrivateFile(join(legacyLocationRoot, LEGACY.location)))
    const value = JSON.parse(text ?? 'null') as unknown
    if (value === null) return { home: defaultHome }
    if (typeof value !== 'object' || !('home' in value) || typeof value.home !== 'string' || !isAbsolute(value.home)) throw new Error('Invalid Next data directory')
    privateDirectory(value.home)
    return { home: resolve(value.home) }
  } catch (error) { return { home: defaultHome, error: String(error) } }
}

export function validateDataDirectory(target: string, current: string, defaultHome: string): string {
  if (!isAbsolute(target) || target.includes('\0')) throw new Error('Data directory must be an absolute path')
  const destination = resolve(target)
  const nested = relative(current, destination)
  // A descendant is inside the current data directory whatever its name; only the parent branch
  // and other trees are "outside". `startsWith('..')` also matched children such as `..cache`.
  const inside = nested !== '' && nested !== '..' && !nested.startsWith(`..${sep}`) && !isAbsolute(nested)
  if (inside) throw new Error('Choose a directory outside the current data directory')
  privateDirectory(destination)
  const entries = readdirSync(destination)
  if (destination !== defaultHome && destination !== current && entries.length > 0
    && readPrivateFile(join(destination, 'nonead-dsh-desktop.json')) === undefined
    && readPrivateFile(join(destination, LEGACY.selection)) === undefined
    && readPrivateFile(join(destination, 'profiles', 'desktop', 'package.json')) === undefined) {
    throw new Error('Choose an empty directory or an existing Next data directory')
  }
  return destination
}
