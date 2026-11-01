import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { NextProfiles } from '../src/profiles.ts'
import { NextRecovery } from '../src/recovery.ts'

const homes: string[] = []
function fixture() {
  const home = mkdtempSync(join(tmpdir(), 'next-recovery-cache-'))
  homes.push(home)
  const profiles = new NextProfiles(home)
  const directory = profiles.ensure('desktop')
  return { directory, profiles, recovery: new NextRecovery(profiles) }
}
afterEach(() => { vi.restoreAllMocks(); homes.splice(0).forEach(home => rmSync(home, { recursive: true, force: true })) })

it('describes each snapshot once while the recovery directory keeps its mtime', () => {
  const { directory, recovery } = fixture()
  writeFileSync(join(directory, 'cordis.patch.yml'), '# first\n[]\n')
  recovery.checkpoint('desktop')
  const before = recovery.list('desktop')
  expect(before).toHaveLength(1)
  // Corrupting the snapshot behind the cache's back is invisible while the directory
  // mtime is unchanged: a second listing must return the cached scan instead of
  // re-reading the snapshot, and every caller shares that one scan.
  writeFileSync(join(before[0]!.directory, 'snapshot.json'), 'not json')
  expect(recovery.list('desktop')).toEqual(before)
  expect(recovery.checkpoints('desktop')).toEqual(before)
  expect(recovery.latest('desktop')).toEqual(before[0])
})

it('drops the cached scan once the directory mtime moves', () => {
  const { directory, recovery } = fixture()
  writeFileSync(join(directory, 'cordis.patch.yml'), '# first\n[]\n')
  recovery.checkpoint('desktop')
  const before = recovery.list('desktop')
  expect(before).toHaveLength(1)
  writeFileSync(join(before[0]!.directory, 'snapshot.json'), 'not json')
  expect(recovery.list('desktop')).toEqual(before)
  // Moving the directory mtime is what makes the listing stale, and the corrupt
  // snapshot then drops out because it can no longer be described.
  const moved = new Date(Date.now() + 60_000)
  utimesSync(recovery.directory, moved, moved)
  expect(recovery.list('desktop')).toEqual([])
})

it('notices a snapshot that was removed and one that was added', () => {
  const { directory, recovery } = fixture()
  recovery.checkpoint('desktop')
  const first = recovery.list('desktop')
  expect(first).toHaveLength(1)
  // A snapshot deleted outside this process must not survive in the cached listing.
  rmSync(first[0]!.directory, { recursive: true, force: true })
  expect(recovery.list('desktop')).toEqual([])
  // A new snapshot is listed right away, whatever the cache was holding.
  writeFileSync(join(directory, 'cordis.patch.yml'), '# second\n[]\n')
  recovery.backup('desktop', 'before-rollback')
  expect(recovery.list('desktop').map(item => item.kind)).toEqual(['before-rollback'])
  expect(recovery.checkpoints('desktop')).toEqual([])
})
