/** Shell-owned configuration reads must validate the file they actually open. */
import { mkdtempSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { atomicText, privateDirectory, readPrivateFile } from '../src/private-files.ts'

const roots: string[] = []
const swappedResolvers: (() => void)[] = []
function root(): string {
  const directory = mkdtempSync(join(tmpdir(), 'next-private-files-'))
  roots.push(directory)
  return directory
}
afterEach(() => {
  for (const restore of swappedResolvers.splice(0)) restore()
  for (const directory of roots.splice(0)) rmSync(directory, { recursive: true, force: true })
  vi.restoreAllMocks()
})

it('reads a regular file and reports a missing entry without throwing', () => {
  const directory = root()
  const file = join(directory, 'state.json')
  writeFileSync(file, '{"version":1}')
  expect(readPrivateFile(file)).toBe('{"version":1}')
  expect(readPrivateFile(join(directory, 'absent.json'))).toBeUndefined()
})

it('round-trips what the atomic writer stores', () => {
  const directory = root()
  const file = join(directory, 'nested', 'state.json')
  privateDirectory(join(directory, 'nested'))
  atomicText(file, 'value\n')
  expect(readPrivateFile(file)).toBe('value\n')
})

it('refuses a non-regular, oversized, or linked path', () => {
  const directory = root()
  const oversized = join(directory, 'big.json')
  writeFileSync(oversized, 'more than four')
  expect(() => readPrivateFile(oversized, 4)).toThrow(/regular file smaller than 4 bytes/u)
  expect(() => readPrivateFile(directory)).toThrow(/regular file/u)
  // File symlinks need a privilege Windows does not grant by default (the repository's known
  // environment limit); the swap case below covers the verification on every platform.
  if (process.platform === 'win32') return
  const target = join(directory, 'real.json')
  const link = join(directory, 'link.json')
  writeFileSync(target, '{}')
  symlinkSync(target, link)
  expect(() => readPrivateFile(link)).toThrow(/regular file/u)
})

/** Replace the entry in the exact window the reader used to leave open: between `lstat` and the
 * content read (`isLinkedPath` resolves the path in between). Restores the native resolver. */
function swapDuringRead(file: string, swap: (attempt: number) => void): { attempts: () => number } {
  const native = realpathSync.native
  let attempts = 0
  realpathSync.native = ((path: string, ...rest: unknown[]) => {
    if (typeof path === 'string' && resolve(path) === resolve(file)) {
      attempts += 1
      swap(attempts)
    }
    return (native as (...args: unknown[]) => string)(path, ...rest)
  }) as typeof realpathSync.native
  swappedResolvers.push(() => { realpathSync.native = native })
  return { attempts: () => attempts }
}

it('tolerates one atomic replacement by a Profile writer instead of failing the read', () => {
  const directory = root()
  const file = join(directory, 'state.json')
  writeFileSync(file, '{"writer":"shell"}')
  const swap = swapDuringRead(file, attempt => {
    if (attempt > 1) return
    const planted = join(directory, `planted-${attempt}.json`)
    writeFileSync(planted, '{"writer":"host"}')
    renameSync(planted, file)
  })
  // A profile writer replaces the file with an atomic rename; the re-validation reads the current
  // inode once more rather than turning the race into a failed configuration read.
  expect(readPrivateFile(file)).toBe('{"writer":"host"}')
  expect(swap.attempts()).toBe(2)
})

it('refuses an entry that keeps changing between the check and the read', () => {
  const directory = root()
  const file = join(directory, 'state.json')
  writeFileSync(file, '{"checked":true}')
  const swap = swapDuringRead(file, attempt => {
    const planted = join(directory, `planted-${attempt}.json`)
    writeFileSync(planted, `{"planted":${attempt}}`)
    renameSync(planted, file)
  })
  expect(() => readPrivateFile(file)).toThrow(/regular file/u)
  // Every attempt re-validated the current inode; a path that never settles fails closed.
  expect(swap.attempts()).toBe(2)
})

it('refuses a swap to a file link that happens between the check and the read', () => {
  // File symlinks need a privilege Windows does not grant by default (the repository's known
  // environment limit); the POSIX and macOS runs cover this branch.
  if (process.platform === 'win32') return
  const directory = root()
  const file = join(directory, 'state.json')
  const secret = join(directory, 'secret.json')
  writeFileSync(file, '{"checked":true}')
  writeFileSync(secret, '{"secret":true}')
  swapDuringRead(file, () => {
    rmSync(file, { force: true })
    symlinkSync(secret, file)
  })
  expect(() => readPrivateFile(file)).toThrow(/regular file/u)
})
