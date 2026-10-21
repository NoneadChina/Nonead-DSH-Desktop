/**
 * Persisted "skip this version" decision.
 *
 * A skipped version must survive restarts: the update check runs unattended every six hours, so an
 * in-memory flag would offer the same release again on the next launch. The file lives inside the
 * shell's own `next-updates` cache directory, which the update owner already treats as private and
 * never deletes outside its own `download-*` entries.
 */
import { join } from 'node:path'
import { atomicJson, privateDirectory, readPrivateFile } from './private-files.ts'

/** Only a SemVer-shaped string is stored; anything else is treated as a corrupt record. */
const VERSION = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u

export function skippedVersionFile(userData: string): string {
  return join(userData, 'next-updates', 'skipped-version.json')
}

/**
 * @returns the skipped version, or `undefined` when nothing usable is stored.
 * Failures stay silent for the caller's flow: a corrupt or unreadable record must not block an
 * update, so it is reported through `log` and otherwise ignored.
 */
export function readSkippedVersion(userData: string, log?: (error: unknown) => void): string | undefined {
  try {
    const text = readPrivateFile(skippedVersionFile(userData), 4096)
    if (text === undefined) return undefined
    const value = JSON.parse(text) as { version?: unknown }
    return typeof value.version === 'string' && VERSION.test(value.version) ? value.version : undefined
  } catch (error) { log?.(error); return undefined }
}

export function writeSkippedVersion(userData: string, version: string): void {
  if (!VERSION.test(version)) throw new Error(`Invalid update version to skip: ${version}`)
  privateDirectory(join(userData, 'next-updates'))
  atomicJson(skippedVersionFile(userData), { version })
}

export function clearSkippedVersion(userData: string): void {
  // Overwrite with an empty record instead of unlinking: `atomicJson` keeps the same
  // regular-file-only guarantees the rest of the shell relies on for its private state.
  privateDirectory(join(userData, 'next-updates'))
  atomicJson(skippedVersionFile(userData), {})
}
