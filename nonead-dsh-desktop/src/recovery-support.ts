/**
 * Shell support shared by profile writing and recovery feedback.
 *
 * The Profile configuration (`<profile>/package.json`, `cordis.patch.yml`) is
 * shared with the Host's profile manager, so every read-modify-write cycle
 * must run under one writer lock: an unlocked cycle can read a state the other
 * writer has already replaced and write it back, silently dropping that
 * update.
 *
 * `withFileLock` from `@deepseek-ai/dsh-atomic-write` is asynchronous, but the
 * shell's Profile writers in `profiles.ts` are synchronous (they are called
 * from synchronous IPC paths in `main.ts`, which is not ours to make async).
 * This module therefore implements the *same on-disk protocol* synchronously:
 * `<profile>/lock.lock`, exclusive create, a `<pid>\n` holder record, and
 * takeover of a holder whose process is gone. `withFileLock(join(dir, 'lock'))`
 * names that identical path, so an asynchronous recovery write
 * (`restore`, `setBundleSelected`, `recover`) and a synchronous shell write
 * contend on one lock instead of two.
 *
 * The wait is bounded and blocks the calling thread. It is sized like the
 * library default because the lock is only ever held across local file work;
 * a caller that legitimately holds it longer must pass a larger `waitMs`.
 */
import { createHash } from 'node:crypto'
import { closeSync, existsSync, lstatSync, openSync, readFileSync, rmSync, writeSync } from 'node:fs'
import { join } from 'node:path'

/** Options for one {@link withProfileWriteLock} acquisition. */
export interface ProfileWriteLockOptions {
  /** How long to wait for another writer, in milliseconds. */
  waitMs?: number
}

/**
 * How long a synchronous writer waits by default. Matches the library default
 * so both kinds of writer give up on a stuck holder at the same point.
 */
export const PROFILE_LOCK_WAIT_MS = 2_000

const RETRY_INITIAL_MS = 20
const RETRY_MAX_MS = 200

/**
 * Lock paths this process currently holds, mapped to their nesting depth. A
 * synchronous call stack can only nest into a lock it already holds itself,
 * so depth tracking both keeps nested writers from waiting on themselves and
 * proves the lock is not left behind when an operation throws.
 */
const held = new Map<string, number>()

/**
 * The lock file both writer kinds use.
 * @param profileDirectory - the Profile directory, already validated by `NextProfiles.directory`.
 * @returns The path `withFileLock(join(profileDirectory, 'lock'))` creates.
 */
export function profileLockPath(profileDirectory: string): string {
  return `${join(profileDirectory, 'lock')}.lock`
}

/** Block the current thread, so a contended writer can back off without yielding. */
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/** Whether an exclusive create lost to an existing lock. */
function isContention(error: unknown, lockPath: string): boolean {
  const code = (error as { code?: unknown }).code
  if (code === 'EEXIST') return true
  // Windows reports an existing exclusive-create target as a permission error.
  return code === 'EPERM' && lstatSync(lockPath, { throwIfNoEntry: false }) !== undefined
}

/** Whether a `<pid>\n` record names a process a signal probe proves gone. */
function holderExited(record: string): boolean {
  const match = /^(\d+)\n$/u.exec(record)
  if (!match) return false
  const pid = Number(match[1])
  // A missing or incomplete record is waited for, never taken over: the lock
  // may belong to a live holder that has not finished writing its record.
  if (pid === 0 || pid > 2_147_483_647 || pid === process.pid) return false
  try {
    process.kill(pid, 0)
    return false
  } catch (error) {
    return (error as { code?: unknown }).code === 'ESRCH'
  }
}

/**
 * Remove the lock of a holder proven to be gone. Contenders that read the same
 * record serialize on a claim file named after it and re-check under the claim,
 * so a removal never deletes a lock another contender acquired after the dead
 * holder's — including one whose holder reused that PID.
 * @returns Whether this call removed the dead holder's lock.
 */
function takeOverExitedLock(lockPath: string): boolean {
  let record: string
  try { record = readFileSync(lockPath, 'utf8') } catch { return false }
  if (!holderExited(record)) return false
  const claim = `${lockPath}.takeover-${createHash('sha256').update(record).digest('hex').slice(0, 16)}`
  let descriptor: number
  try { descriptor = openSync(claim, 'wx', 0o600) } catch (error) {
    if (isContention(error, claim)) return false
    throw error
  }
  try { writeSync(descriptor, `${process.pid}\n`) } finally { closeSync(descriptor) }
  try {
    let current: string
    try { current = readFileSync(lockPath, 'utf8') } catch { return false }
    if (current !== record || !holderExited(record)) return false
    rmSync(lockPath, { force: true })
    return true
  } finally { rmSync(claim, { force: true }) }
}

/**
 * Run one Profile read-modify-write cycle while holding the shared writer lock.
 *
 * Nested calls on the same Profile run directly: a synchronous stack that
 * already holds the lock cannot be contended by itself, and waiting would
 * deadlock until the bounded timeout.
 * @param profileDirectory - Profile directory; a directory that does not exist
 *   yet has no shared state to protect, so the operation runs unguarded and
 *   fails on its own missing manifest.
 * @param operation - the read-render-commit cycle to run while holding the lock.
 * @param options - acquisition options; omitted waits {@link PROFILE_LOCK_WAIT_MS}.
 * @returns the operation's result; the lock releases on both outcomes.
 */
export function withProfileWriteLock<T>(
  profileDirectory: string,
  operation: () => T,
  options: ProfileWriteLockOptions = {},
): T {
  const lockPath = profileLockPath(profileDirectory)
  const depth = held.get(lockPath) ?? 0
  if (depth > 0) {
    held.set(lockPath, depth + 1)
    try { return operation() } finally { held.set(lockPath, depth) }
  }
  if (!existsSync(profileDirectory)) return operation()
  const deadline = Date.now() + (options.waitMs ?? PROFILE_LOCK_WAIT_MS)
  let delay = RETRY_INITIAL_MS
  for (;;) {
    try {
      const descriptor = openSync(lockPath, 'wx', 0o600)
      try { writeSync(descriptor, `${process.pid}\n`) } finally { closeSync(descriptor) }
      break
    } catch (error) {
      if (!isContention(error, lockPath)) throw error
      if (takeOverExitedLock(lockPath)) continue
    }
    if (Date.now() >= deadline) throw new Error(`Profile writer lock timed out at ${lockPath}`)
    sleepSync(delay)
    delay = Math.min(delay * 2, RETRY_MAX_MS)
  }
  held.set(lockPath, 1)
  try { return operation() } finally {
    held.delete(lockPath)
    rmSync(lockPath, { force: true })
  }
}

/** Re-exported so the main process keeps one import site for recovery support. */
export { recoverySupport } from './recovery-support-copy.ts'
