/**
 * Path identity for filesystem links, including Windows directory junctions.
 *
 * A junction is the trap: `lstat` reports it as a real directory (`isDirectory() === true`,
 * `isSymbolicLink() === false`) and `readlink` fails with EINVAL, so every guard written against
 * `isSymbolicLink` misses it. `realpathSync.native` is the only call that follows junctions; the
 * JavaScript `realpathSync` returns the link itself on Windows.
 */
import { lstatSync, realpathSync, rmSync, rmdirSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'

/** Windows paths compare case-insensitively and may carry the extended-length prefix. */
function comparablePath(path: string): string {
  const stripped = path.startsWith('\\\\?\\') ? path.slice(4) : path
  return process.platform === 'win32' ? stripped.toLowerCase() : stripped
}

/** Where `path` really points, or `undefined` when it does not point anywhere else. */
export function linkedPathTarget(path: string): string | undefined {
  try {
    const target = realpathSync.native(path)
    // Compare the entry itself: its resolved parent plus its own name. Comparing against
    // resolve(path) would flag every path that merely sits below an already-resolved junction.
    const parent = realpathSync.native(dirname(path))
    return comparablePath(target) === comparablePath(join(parent, basename(path))) ? undefined : target
  } catch { return undefined }
}

/** True when `path` is a symlink or a junction, i.e. its real target lives somewhere else. */
export function isLinkedPath(path: string): boolean { return linkedPathTarget(path) !== undefined }

/** True when both paths name the same location, ignoring Windows case and prefix differences. */
export function sameResolvedPath(a: string, b: string): boolean {
  return comparablePath(resolve(a)) === comparablePath(resolve(b))
}

/**
 * Remove the link at `path` itself, never its target.
 *
 * Windows refuses `unlink` on a directory entry (a junction or a directory symlink) with EPERM and
 * needs `rmdir`, while `rm` picks its syscall from `lstat` — which reports a junction as a directory
 * but a directory symlink as a file. Trying `rm` first and falling back to `rmdir` covers both
 * without ever recursing into the target.
 */
export function removeLinkedPath(path: string): void {
  const info = lstatSync(path, { throwIfNoEntry: false })
  if (info === undefined) {
    // A dangling link is invisible to `lstat` (ENOENT) because its target is gone, yet `rmdir`
    // still removes the link entry itself. Treat "nothing there" as already done.
    try {
      rmdirSync(path)
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') throw cause
    }
    return
  }
  if (!isLinkedPath(path)) throw new Error(`Refusing to remove a path that is not a link: ${path}`)
  // A junction reports `isDirectory() === true`, so it needs `rmdir`; `rm`/`unlink` refuse it and
  // Node surfaces that as `ERR_FS_EISDIR`, not `EISDIR`. A directory symlink reports `false`, so it
  // goes through `rm` first and falls back to `rmdir`.
  if (info.isDirectory()) {
    rmdirSync(path)
    return
  }
  try {
    rmSync(path, { force: true, maxRetries: 2 })
  } catch (cause) {
    const code = (cause as NodeJS.ErrnoException).code
    if (code !== 'EPERM' && code !== 'EISDIR' && code !== 'ERR_FS_EISDIR' && code !== 'ENOTEMPTY') throw cause
    rmdirSync(path)
  }
}
