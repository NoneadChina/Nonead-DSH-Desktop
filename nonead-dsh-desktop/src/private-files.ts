/** Bounded, regular-file-only configuration I/O for shell-owned state. */
import { randomUUID } from 'node:crypto'
import { lstatSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { isLinkedPath, readVerifiedPrivateFile } from '../../dsh-plugin-desktop-beta/src/fs-links.ts'
import { insideArchive } from './asar-archive-policy.ts'

// Link semantics live in one place: a Windows junction reports `isDirectory()` and is invisible to
// `lstat().isSymbolicLink()`, so every guard here has to go through the shared helper.
export { isLinkedPath, linkedPathTarget, removeLinkedPath, sameResolvedPath } from '../../dsh-plugin-desktop-beta/src/fs-links.ts'

export function privateDirectory(path: string): void {
  const parent = dirname(resolve(path))
  if (parent !== path) {
    const info = lstatSync(parent, { throwIfNoEntry: false })
    if (info && (!info.isDirectory() || isLinkedPath(parent))) throw new Error(`Expected a real directory: ${parent}`)
    if (!info) privateDirectory(parent)
  }
  const info = lstatSync(path, { throwIfNoEntry: false })
  if (info && (!info.isDirectory() || isLinkedPath(path))) throw new Error(`Expected a real directory: ${path}`)
  if (!info) mkdirSync(path, { mode: 0o700 })
}

/**
 * Read one shell-owned configuration file.
 *
 * The path is validated with `lstat`, then the *validated inode* is reopened: reading the path
 * again left a window in which another process (or a planted link) could swap the entry between
 * the check and the read. `readVerifiedPrivateFile` opens with `O_NOFOLLOW` where the platform
 * supports it and requires the opened descriptor to carry the checked device/inode.
 *
 * A Profile writer replacing the same file with an atomic rename trips the inode check once, so a
 * detected swap re-validates the current entry exactly once instead of turning a benign writer
 * race into a read failure; an entry that keeps changing (or is now a link) fails closed.
 * @param path - absolute path of the configuration file.
 * @param limit - largest content accepted, in bytes.
 * @returns the file text, or `undefined` when the entry does not exist.
 */
export function readPrivateFile(path: string, limit = 1024 * 1024): string | undefined {
  const invalid = (): Error => new Error(`Configuration must be a regular file smaller than ${limit} bytes: ${path}`)
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const info = lstatSync(path, { throwIfNoEntry: false })
    if (!info) return undefined
    if (!info.isFile() || isLinkedPath(path) || info.size > limit) throw invalid()
    // An archive member is immutable while the application runs, and Electron reports synthetic
    // stats for it (the verified reopen would see another device/inode), so only real paths reopen.
    if (insideArchive(path)) return readFileSync(path, 'utf8')
    const read = readVerifiedPrivateFile(path, info, limit)
    if (read.status === 'ok') return read.bytes.toString('utf8')
    // The entry vanished between the check and the open: same answer as a missing file.
    if (read.status === 'missing') return undefined
    if (read.status === 'changed' && attempt === 0) continue
    throw invalid()
  }
  throw invalid()
}

export function atomicText(path: string, text: string): void {
  privateDirectory(dirname(path))
  const info = lstatSync(path, { throwIfNoEntry: false })
  if (info && (!info.isFile() || isLinkedPath(path))) throw new Error(`Refusing to replace a linked or non-file configuration: ${path}`)
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    writeFileSync(temporary, text, { mode: 0o600, flag: 'wx' })
    renameSync(temporary, path)
  } finally { rmSync(temporary, { force: true }) }
}

export function atomicJson(path: string, value: unknown): void { atomicText(path, `${JSON.stringify(value, null, 2)}\n`) }
