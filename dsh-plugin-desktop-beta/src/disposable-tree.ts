/** Cleanup for caller-owned disposable trees; never traverse junction targets. */
import { lstatSync, readdirSync, rmdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { isLinkedPath, removeLinkedPath } from './fs-links.ts'

const CLEANUP_RETRY_CODES = new Set(['EBUSY', 'EMFILE', 'ENFILE', 'ENOTEMPTY', 'EPERM'])

function removeDisposableEntry(path: string): void {
  try {
    const stat = lstatSync(path)
    // A junction is a directory entry that `lstat` reports as a real directory; recursing into it
    // would empty the target instead of removing the link.
    if (isLinkedPath(path)) {
      removeLinkedPath(path)
      return
    }
    if (!stat.isDirectory()) {
      unlinkSync(path)
      return
    }
    for (const name of readdirSync(path)) removeDisposableEntry(join(path, name))
    rmdirSync(path)
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') {
      // A dangling junction has no `lstat` entry left (its target is gone) yet still occupies the
      // directory slot; `rmdir` removes the link itself without needing the target.
      try { rmdirSync(path) } catch { /* already gone */ }
      return
    }
    throw cause
  }
}

/** Remove an owned temporary root, including a root junction, with bounded retries. */
export function cleanupDisposableTree(rootDir: string): boolean {
  try {
    lstatSync(rootDir)
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw cause
  }
  for (let attempt = 0; ; attempt++) {
    try {
      removeDisposableEntry(rootDir)
      return true
    } catch (cause) {
      if (attempt >= 3 || !CLEANUP_RETRY_CODES.has((cause as NodeJS.ErrnoException).code ?? '')) throw cause
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100 * (attempt + 1))
    }
  }
}
