/**
 * Path identity for filesystem links, including Windows directory junctions.
 *
 * A junction is the trap: `lstat` reports it as a real directory (`isDirectory() === true`,
 * `isSymbolicLink() === false`) and `readlink` fails with EINVAL, so every guard written against
 * `isSymbolicLink` misses it. `realpathSync.native` is the only call that follows junctions; the
 * JavaScript `realpathSync` returns the link itself on Windows.
 *
 * The module also owns the shared private-file read: every Desktop-owned state store validates a
 * path with `lstat` and then has to open that same inode without following a link or a swap.
 */
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
  rmSync,
  rmdirSync,
} from 'node:fs'
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

/** Result of {@link readVerifiedPrivateFile}. */
export type VerifiedPrivateFileRead =
  | {
      readonly status: 'ok'
      /** Complete file contents read from the verified descriptor. */
      readonly bytes: Buffer
      /** Raw `st_mode` of the opened file; callers mask their own permission bits. */
      readonly mode: number
    }
  /** The entry disappeared between `lstat` and the open. */
  | { readonly status: 'missing' }
  /** The opened descriptor is not a regular file. */
  | { readonly status: 'type' }
  /** The path now names a different inode than the caller validated. */
  | { readonly status: 'changed' }
  /** The opened file exceeds the caller's size limit. */
  | { readonly status: 'size' }

/**
 * Read one private file whose identity was already established by `lstat`.
 *
 * Every Desktop-owned state store validates a path with `lstat` and then reads it, which leaves a
 * window in which the path can be replaced by a link or by another file. This opens the path with
 * `O_NOFOLLOW` (where the platform supports it) and requires the opened descriptor to be a regular
 * file with the same device and inode as the validated `lstat` snapshot; only then is the content
 * returned. On Windows `O_NOFOLLOW` is unavailable and resolves to 0, so the device/inode check is
 * what closes the window there.
 * @param path - absolute path already validated by the caller.
 * @param expected - device and inode numbers from the caller's `lstat` snapshot.
 * @param maxBytes - largest content the caller accepts.
 * @returns the verified content, or why it must be rejected.
 */
export function readVerifiedPrivateFile(
  path: string,
  expected: { readonly dev: number; readonly ino: number },
  maxBytes: number,
): VerifiedPrivateFileRead {
  let descriptor: number
  try {
    descriptor = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException | null)?.code === 'ENOENT') return { status: 'missing' }
    throw cause
  }
  try {
    const opened = fstatSync(descriptor)
    if (!opened.isFile()) return { status: 'type' }
    if (opened.dev !== expected.dev || opened.ino !== expected.ino) return { status: 'changed' }
    if (opened.size > maxBytes) return { status: 'size' }
    const bytes = readFileSync(descriptor)
    // A file that grew between `fstat` and the read is still cut off at the caller's limit.
    if (bytes.byteLength > maxBytes) return { status: 'size' }
    return { status: 'ok', bytes, mode: opened.mode }
  } finally {
    closeSync(descriptor)
  }
}
