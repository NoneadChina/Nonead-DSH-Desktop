import { existsSync, mkdirSync, mkdtempSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanupDisposableTree } from '../src/disposable-tree.ts'
import {
  acquireDesktopDataOperationLock,
  assertDesktopDataOperationLockOwner,
  desktopDataOperationLockPath,
} from '../src/desktop-data-operation-lock.ts'
import { DesktopDataDirectoryError } from '../src/desktop-data-directory.ts'

const roots: string[] = []

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-beta-operation-lock-'))
  roots.push(root)
  return root
}

function busyMessage(run: () => unknown): string {
  try {
    run()
  } catch (cause) {
    expect(cause).toBeInstanceOf(DesktopDataDirectoryError)
    return (cause as Error).message
  }
  throw new Error('expected a busy failure')
}

afterEach(() => {
  for (const root of roots.splice(0)) cleanupDisposableTree(root)
})

describe('Desktop data operation lock', () => {
  it('excludes a second owner and names the operation that holds it', () => {
    const root = fixture()
    const lease = acquireDesktopDataOperationLock(root, 'move data directory')
    try {
      expect(lease.id).toMatch(/^[0-9a-f-]{36}$/u)
      expect(lease.operation).toBe('move data directory')
      expect(busyMessage(() => acquireDesktopDataOperationLock(root, 'factory reset')))
        .toContain('busy with move data directory')
    } finally {
      lease.release()
    }
    expect(existsSync(desktopDataOperationLockPath(root))).toBe(false)
  })

  it('reclaims a record whose process no longer exists', () => {
    const root = fixture()
    const path = desktopDataOperationLockPath(root)
    mkdirSync(join(root, 'data-directory'), { recursive: true })
    writeFileSync(path, `${JSON.stringify({
      id: '00000000-0000-4000-8000-000000000000',
      pid: 0x7ffffff,
      operation: 'abandoned operation',
      createdAt: new Date(0).toISOString(),
    })}\n`)
    const lease = acquireDesktopDataOperationLock(root, 'recovered operation')
    try {
      expect(JSON.parse(readFileSync(path, 'utf8')).operation).toBe('recovered operation')
    } finally {
      lease.release()
    }
    expect(existsSync(path)).toBe(false)
  })

  it('reports a vanished record as a stale lock instead of a raw file-system error', () => {
    const root = fixture()
    const lease = acquireDesktopDataOperationLock(root, 'factory reset')
    const path = desktopDataOperationLockPath(root)
    unlinkSync(path)
    expect(busyMessage(() => { lease.release() })).toContain('ownership changed')
    // Release remains idempotent for the caller's own lease.
    expect(() => { lease.release() }).not.toThrow()
  })

  it('reports a vanished record as a stale token for a managed child', () => {
    const root = fixture()
    const lease = acquireDesktopDataOperationLock(root, 'plugin install')
    try {
      expect(() => { assertDesktopDataOperationLockOwner(root, lease.id) }).not.toThrow()
      expect(busyMessage(() => { assertDesktopDataOperationLockOwner(root, 'another-token') }))
        .toContain('token is stale')
      unlinkSync(desktopDataOperationLockPath(root))
      expect(busyMessage(() => { assertDesktopDataOperationLockOwner(root, lease.id) }))
        .toContain('token is stale')
    } finally {
      try { lease.release() } catch { /* the record was removed above */ }
    }
  })

  it('refuses a lock entry that is not a small regular file', () => {
    const root = fixture()
    const path = desktopDataOperationLockPath(root)
    mkdirSync(join(root, 'data-directory'), { recursive: true })
    mkdirSync(path)
    expect(busyMessage(() => acquireDesktopDataOperationLock(root, 'factory reset'))).toContain('unsafe')

    cleanupDisposableTree(path)
    writeFileSync(path, `{"padding":"${'x'.repeat(9000)}"}\n`)
    expect(busyMessage(() => acquireDesktopDataOperationLock(root, 'factory reset'))).toContain('unsafe')
  })

  it('refuses an operation name that cannot be recorded safely', () => {
    const root = fixture()
    expect(busyMessage(() => acquireDesktopDataOperationLock(root, ''))).toContain('name is invalid')
    expect(busyMessage(() => acquireDesktopDataOperationLock(root, 'x'.repeat(129)))).toContain('name is invalid')
    expect(busyMessage(() => acquireDesktopDataOperationLock(root, 'bad\0name'))).toContain('name is invalid')
  })
})
