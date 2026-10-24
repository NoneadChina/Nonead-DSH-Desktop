/** Bounded, regular-file-only configuration I/O for shell-owned state. */
import { randomUUID } from 'node:crypto'
import { lstatSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { isLinkedPath } from '../../dsh-plugin-desktop-beta/src/fs-links.ts'

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

export function readPrivateFile(path: string, limit = 1024 * 1024): string | undefined {
  const info = lstatSync(path, { throwIfNoEntry: false })
  if (!info) return undefined
  if (!info.isFile() || isLinkedPath(path) || info.size > limit) throw new Error(`Configuration must be a regular file smaller than ${limit} bytes: ${path}`)
  return readFileSync(path, 'utf8')
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
