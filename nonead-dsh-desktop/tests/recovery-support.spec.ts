import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { PROFILE_LOCK_WAIT_MS, profileLockPath, recoverySupport, withProfileWriteLock } from '../src/recovery-support.ts'

const roots: string[] = []
function profile() {
  const home = mkdtempSync(join(tmpdir(), 'next-profile-lock-'))
  roots.push(home)
  const directory = join(home, 'profiles', 'desktop')
  mkdirSync(directory, { recursive: true })
  return { home, directory, lock: profileLockPath(directory) }
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

it('links to the project issue page without automatically attaching diagnostic data', () => {
  for (const locale of ['zh', 'en'] as const) {
    const support = recoverySupport(locale)
    expect(support.href).toBe('https://github.com/anywhere-labs/dsh-desktop/issues')
    expect(support.hint).toMatch(locale === 'zh' ? /完整报错.*日志.*敏感信息/u : /full error.*logs.*sensitive information/u)
  }
  expect(recoverySupport('zh').label).toBe('联系我们')
})

it('locks the same file the asynchronous recovery writers use and records this process', () => {
  const { directory, lock } = profile()
  // withFileLock(join(directory, 'lock')) creates exactly this sibling.
  expect(lock).toBe(`${join(directory, 'lock')}.lock`)
  expect(PROFILE_LOCK_WAIT_MS).toBe(2_000)
  const observed = withProfileWriteLock(directory, () => {
    expect(existsSync(lock)).toBe(true)
    return readFileSync(lock, 'utf8')
  })
  expect(observed).toBe(`${process.pid}\n`)
  expect(existsSync(lock)).toBe(false)
})

it('releases the lock when the operation throws', () => {
  const { directory, lock } = profile()
  expect(() => withProfileWriteLock(directory, () => { throw new Error('commit failed') })).toThrow('commit failed')
  expect(existsSync(lock)).toBe(false)
  // The lock is usable again rather than left behind by the failed operation.
  expect(withProfileWriteLock(directory, () => 'retried')).toBe('retried')
  expect(existsSync(lock)).toBe(false)
})

it('runs a nested operation directly instead of waiting on its own lock', () => {
  const { directory, lock } = profile()
  const order: string[] = []
  withProfileWriteLock(directory, () => {
    order.push('outer')
    // `ensure` nests migrations this way: the inner call must not deadlock on
    // a lock the same synchronous stack already holds.
    withProfileWriteLock(directory, () => {
      order.push('inner')
      expect(readFileSync(lock, 'utf8')).toBe(`${process.pid}\n`)
    })
    // Still held by the outer operation after the inner one returned.
    expect(existsSync(lock)).toBe(true)
  })
  expect(order).toEqual(['outer', 'inner'])
  expect(existsSync(lock)).toBe(false)
})

it('takes over the lock of a holder process that exited', () => {
  const { directory, lock } = profile()
  // A PID no live process can own; the probe reports ESRCH.
  writeFileSync(lock, '2147483646\n')
  const started = Date.now()
  expect(withProfileWriteLock(directory, () => readFileSync(lock, 'utf8'), { waitMs: 500 })).toBe(`${process.pid}\n`)
  expect(Date.now() - started).toBeLessThan(500)
  expect(existsSync(lock)).toBe(false)
})

it('waits for a live holder, then fails without deleting its lock', () => {
  const { directory, lock } = profile()
  // A record naming this process is not provably gone, so it is never taken over.
  writeFileSync(lock, `${process.pid}\n`)
  const started = Date.now()
  expect(() => withProfileWriteLock(directory, () => 'unreachable', { waitMs: 50 })).toThrow(/timed out/u)
  expect(Date.now() - started).toBeGreaterThanOrEqual(50)
  expect(readFileSync(lock, 'utf8')).toBe(`${process.pid}\n`)
  // An incomplete record is waited for as well: the holder may still write it.
  writeFileSync(lock, '')
  expect(() => withProfileWriteLock(directory, () => 'unreachable', { waitMs: 20 })).toThrow(/timed out/u)
})

it('does not create a lock for a Profile directory that does not exist yet', () => {
  const { home } = profile()
  const missing = join(home, 'profiles', 'work')
  expect(() => withProfileWriteLock(missing, () => readFileSync(join(missing, 'package.json'), 'utf8'))).toThrow()
  expect(existsSync(join(missing, 'lock.lock'))).toBe(false)
})
