/** Back up configuration without importing user packages or touching conversations. */
import { createHash, randomUUID } from 'node:crypto'
import { lstatSync, mkdirSync, readdirSync, renameSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { withFileLock } from '@deepseek-ai/dsh-atomic-write'
import { atomicJson, atomicText, privateDirectory, readPrivateFile } from './private-files.ts'
import { LEGACY } from './legacy-names.ts'
import { NextProfiles, profileName, WEB_BUNDLES, NEXT_PACKAGE } from './profiles.ts'
import { DEFAULT_PROFILE } from './desktop-contract.ts'

const FILES = ['package.json', 'cordis.patch.yml', 'nonead-dsh-desktop.features.json'] as const
type ConfigFile = typeof FILES[number]
/** A profile written before the rename still carries the legacy features file. */
const readConfigFile = (directory: string, file: ConfigFile): string | undefined =>
  readPrivateFile(join(directory, file))
  ?? (file === 'nonead-dsh-desktop.features.json' ? readPrivateFile(join(directory, LEGACY.features)) : undefined)
interface Snapshot {
  version: 1
  profile: string
  created: string
  reason: string
  healthy: boolean
  files: Record<ConfigFile, { sha256: string } | null>
}
/**
 * One recoverable configuration snapshot. `kind` is the reason the snapshot was
 * taken (display metadata, never a policy) and `healthy` records whether it
 * captured a configuration that had started successfully.
 */
export interface RecoveryCheckpoint {
  directory: string
  id: string
  created: string
  kind: string
  healthy: boolean
  fileCount: number
  totalBytes: number
}
/** How many snapshots `list()` returns when the caller states no limit. */
const LIST_LIMIT = 50
/** One readable snapshot with the parsed manifest its health filter needs. */
interface Scanned {
  snapshot: Snapshot
  checkpoint: RecoveryCheckpoint
}
/** A snapshot directory is named `<Date.now()>-<uuid>`; nothing else is a checkpoint id. */
const CHECKPOINT_ID = /^\d{1,16}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u
const digest = (text: string): string => createHash('sha256').update(text).digest('hex')

export class NextRecovery {
  readonly directory: string
  /**
   * The last listing of each Profile, keyed by the recovery directory's mtime.
   * `state()` and the tray refresh call `list()` on every update, and describing one
   * snapshot re-reads its three files; a snapshot added or removed changes the
   * directory mtime, which is what makes this stale.
   */
  private readonly scanned = new Map<string, { mtimeMs: number; entries: Scanned[] }>()
  constructor(readonly profiles: NextProfiles) { this.directory = join(profiles.home, 'recovery') }

  backup(name: string, reason: string, healthy = false): string {
    const dir = this.profiles.directory(name)
    const contents = Object.fromEntries(FILES.map(file => [file, readConfigFile(dir, file)])) as Record<ConfigFile, string | undefined>
    privateDirectory(this.directory)
    const target = join(this.directory, `${Date.now()}-${randomUUID()}`)
    privateDirectory(target)
    const files = Object.fromEntries(FILES.map(file => {
      const text = contents[file]
      if (text !== undefined) atomicText(join(target, file), text)
      return [file, text === undefined ? null : { sha256: digest(text) }]
    })) as Snapshot['files']
    atomicJson(join(target, 'snapshot.json'), { version: 1, profile: name, created: new Date().toISOString(), reason, healthy, files } satisfies Snapshot)
    // A snapshot written inside the same mtime tick as the cached listing must not be
    // hidden by it, so the writer drops the cache instead of trusting the clock.
    this.scanned.clear()
    return target
  }

  /**
   * The newest successfully started configuration, which is the only implicit
   * rollback target. A `before-*` snapshot is deliberately not a candidate: it
   * is not known to start, so it must be named explicitly through {@link restore}.
   */
  latest(name: string): RecoveryCheckpoint | null { return this.checkpoints(name)[0] ?? null }

  /** The healthy checkpoints the rollback chooser offers, newest first. */
  checkpoints(name: string): RecoveryCheckpoint[] {
    return this.scan(name, snapshot => snapshot.healthy, 3)
  }

  /**
   * Every snapshot this Profile owns, newest first, whatever produced it: a
   * successful start, or the `before-rollback` / `before-plugin-disable` /
   * `before-profile-repair` snapshot a repair, a plugin change or an earlier
   * rollback took. Listing them is what makes those states reachable again.
   * @param name - Profile name.
   * @param limit - maximum entries; the newest are kept.
   */
  list(name: string, limit = LIST_LIMIT): RecoveryCheckpoint[] {
    return this.scan(name, () => true, limit)
  }

  /**
   * One snapshot of this Profile by id, healthy or not.
   * @param name - Profile name.
   * @param id - snapshot directory name, as returned by {@link checkpoints} or {@link list}.
   * @returns the checkpoint, or undefined for an unknown, malformed or corrupt id.
   */
  find(name: string, id: string): RecoveryCheckpoint | undefined {
    profileName(name)
    if (!CHECKPOINT_ID.test(id)) return undefined
    const directory = join(this.directory, id)
    try { return this.describe(directory, id, this.readSnapshot(directory, name)) } catch { return undefined }
  }

  private scan(name: string, accept: (snapshot: Snapshot) => boolean, limit: number): RecoveryCheckpoint[] {
    const result: RecoveryCheckpoint[] = []
    for (const entry of this.entries(name)) {
      // The listing is cached whole, so every caller applies its own limit to it.
      if (result.length >= limit) break
      if (accept(entry.snapshot)) result.push(entry.checkpoint)
    }
    return result
  }

  /**
   * The readable snapshots of one Profile, newest first, re-read only when the
   * recovery directory changed. A missing directory is an empty listing, not an
   * error: it is created by the first backup.
   */
  private entries(name: string): Scanned[] {
    profileName(name)
    const stat = lstatSync(this.directory, { throwIfNoEntry: false })
    if (!stat) return []
    privateDirectory(this.directory)
    const cached = this.scanned.get(name)
    if (cached?.mtimeMs === stat.mtimeMs) return cached.entries
    // Fixed-width timestamps sort chronologically, so the entry name is the
    // newest-first order; anything that is not a checkpoint id is not one.
    const names = readdirSync(this.directory, { withFileTypes: true }).filter(entry => entry.isDirectory())
      .map(entry => entry.name).sort().reverse()
    const entries: Scanned[] = []
    for (const entry of names) {
      if (!CHECKPOINT_ID.test(entry)) continue
      const directory = join(this.directory, entry)
      try {
        const snapshot = this.readSnapshot(directory, name)
        entries.push({ snapshot, checkpoint: this.describe(directory, entry, snapshot) })
      } catch { /* A partial or corrupt backup cannot become a restore target. */ }
    }
    this.scanned.set(name, { mtimeMs: stat.mtimeMs, entries })
    return entries
  }

  /** Describe one readable snapshot; the caller has already validated it. */
  private describe(directory: string, id: string, snapshot: Snapshot): RecoveryCheckpoint {
    const contents = FILES.map(file => readPrivateFile(join(directory, file)))
    return { directory, id, created: snapshot.created, kind: snapshot.reason, healthy: snapshot.healthy,
      fileCount: contents.filter(text => text !== undefined).length,
      totalBytes: contents.reduce((sum, text) => sum + Buffer.byteLength(text ?? ''), 0) }
  }

  checkpoint(name: string): void {
    const latest = this.latest(name)
    if (latest) {
      const previous = this.readSnapshot(latest.directory, name)
      if (FILES.every(file => {
        const text = readConfigFile(this.profiles.directory(name), file)
        return text === undefined ? previous.files[file] === null : previous.files[file]?.sha256 === digest(text)
      })) return
    }
    this.backup(name, 'successful-start', true)
  }

  /**
   * Restore one snapshot, verifying every byte first.
   *
   * An omitted id restores the newest successfully started configuration. An
   * explicit id may name any snapshot this Profile owns — including the
   * `before-*` snapshots a repair, a plugin change or an earlier rollback took —
   * because that is what makes those states reachable and a rollback itself
   * reversible.
   * @param name - Profile name.
   * @param id - snapshot id; omitted selects the newest healthy checkpoint.
   */
  async restore(name: string, id?: string): Promise<void> {
    const dir = this.profiles.directory(name)
    // The lock file lives in the Profile directory, so a Profile removed by a
    // reset is recreated (empty) before its configuration is restored into it.
    mkdirSync(dir, { recursive: true, mode: 0o700 })
    await withFileLock(join(dir, 'lock'), async () => {
      // Resolve under the lock: a checkpoint must not be replaced between the
      // lookup that approved the target and the write that applies it.
      const checkpoint = id === undefined ? this.latest(name) : this.find(name, id)
      if (!checkpoint) throw new Error('No recovery checkpoint is available')
      const snapshot = this.readSnapshot(checkpoint.directory, name)
      // Verify the complete snapshot before making any change.
      const contents = FILES.map(file => {
        const text = readPrivateFile(join(checkpoint.directory, file))
        const saved = snapshot.files[file]
        if (saved === null ? text !== undefined : text === undefined || digest(text) !== saved.sha256) throw new Error('Recovery backup checksum mismatch')
        return [file, text] as const
      })
      // Snapshot the state being replaced first, so this rollback is undoable too.
      this.backup(name, 'before-rollback')
      for (const [file, text] of contents) {
        const path = join(dir, file)
        if (text !== undefined) atomicText(path, text)
        else if (readPrivateFile(path) !== undefined) unlinkSync(path)
      }
    })
  }

  bundles(name: string) {
    const manifest = JSON.parse(readPrivateFile(join(this.profiles.directory(name), 'package.json')) ?? '{}')
    const bundles: unknown = manifest.dsh?.profile?.bundles
    const ledger: unknown = manifest.dsh?.desktopNextDeselectedBundles ?? []
    if (!Array.isArray(bundles) || bundles.some(item => typeof item !== 'string')
      || !Array.isArray(ledger) || ledger.some(item => typeof item !== 'string')) throw new Error('Invalid Next Profile manifest')
    // Default web layers are only part of the product: optional shipped bundles
    // and official extensions must never become recovery uninstall targets.
    const shipped = JSON.parse(readPrivateFile(NEXT_PACKAGE)!) as {
      name: string; dependencies?: Record<string, string>; dsh?: { optionalBundles?: string[] }
    }
    const protectedNames = new Set([shipped.name, ...WEB_BUNDLES,
      ...Object.keys(shipped.dependencies ?? {}), ...shipped.dsh?.optionalBundles ?? []])
    const eligible = (packageName: string): boolean =>
      !protectedNames.has(packageName) && !packageName.startsWith('@deepseek-ai/')
    const selected = [...new Set(bundles as string[])].filter(eligible)
    // A deselected name is only shown while it is still a declared dependency:
    // reselected or uninstalled elsewhere, the ledger entry is simply forgotten.
    const dependencies = new Set(Object.keys(manifest.dependencies ?? {}))
    const deselected = [...new Set(ledger as string[])].filter(packageName =>
      eligible(packageName) && dependencies.has(packageName) && !selected.includes(packageName))
    return [
      ...selected.map(packageName => ({ bundleId: packageName, packageName,
        status: 'active' as const, owner: 'profile' as const, action: 'uninstall' as const, toggle: 'disable' as const })),
      ...deselected.map(packageName => ({ bundleId: packageName, packageName,
        status: 'disabled' as const, owner: 'profile' as const, action: 'uninstall' as const, toggle: 'enable' as const })),
    ]
  }

  /**
   * Select or deselect one eligible bundle in `dsh.profile.bundles`. Nothing is
   * deleted: the dependency entry and the installed package both stay, so the
   * change is reversible and needs no package manager run.
   */
  async setBundleSelected(name: string, packageName: string, selected: boolean): Promise<void> {
    const target = this.bundles(name).find(item => item.packageName === packageName)
    if (!target || target.toggle !== (selected ? 'enable' : 'disable')) throw new Error('This plugin cannot be changed')
    const dir = this.profiles.directory(name)
    await withFileLock(join(dir, 'lock'), async () => {
      this.backup(name, selected ? 'before-plugin-enable' : 'before-plugin-disable')
      const manifest = JSON.parse(readPrivateFile(join(dir, 'package.json')) ?? '{}')
      const bundles: unknown = manifest.dsh?.profile?.bundles
      if (!Array.isArray(bundles) || bundles.some(item => typeof item !== 'string')) throw new Error('Invalid Next Profile manifest')
      manifest.dsh.profile.bundles = selected
        ? [...(bundles as string[]).filter(item => item !== packageName), packageName]
        : (bundles as string[]).filter(item => item !== packageName)
      const previous: unknown = manifest.dsh.desktopNextDeselectedBundles ?? []
      const ledger = new Set(Array.isArray(previous) ? previous as string[] : [])
      if (selected) ledger.delete(packageName)
      else ledger.add(packageName)
      if (ledger.size === 0) delete manifest.dsh.desktopNextDeselectedBundles
      else manifest.dsh.desktopNextDeselectedBundles = [...ledger].sort()
      atomicJson(join(dir, 'package.json'), manifest)
    })
  }

  /** The original environment is stopped by the shell before resetting its data. */
  factoryReset(): string {
    privateDirectory(this.directory)
    const backup = join(this.directory, `factory-reset-${Date.now()}-${randomUUID()}`)
    privateDirectory(backup)
    for (const entry of readdirSync(this.profiles.home)) {
      if (['recovery', 'electron-user-data', 'nonead-dsh-desktop-location.json', LEGACY.location].includes(entry)) continue
      renameSync(join(this.profiles.home, entry), join(backup, entry))
    }
    return backup
  }

  repairGlobalPatch(): void {
    const path = join(this.profiles.home, 'cordis.patch.yml')
    const text = readPrivateFile(path)
    if (text === undefined) return
    privateDirectory(this.directory)
    const backup = join(this.directory, `global-patch-${Date.now()}-${randomUUID()}.yml`)
    atomicText(backup, text)
    atomicText(path, '[]\n')
  }

  removeProfile(name: string, active: string): void {
    if (name === active || name === DEFAULT_PROFILE) throw new Error('The active and default Profiles cannot be removed')
    const source = this.profiles.directory(name)
    if (!this.profiles.list().includes(name)) throw new Error('Profile does not exist')
    privateDirectory(this.directory)
    const removed = join(this.directory, 'removed-profiles')
    privateDirectory(removed)
    renameSync(source, join(removed, `${name}-${Date.now()}-${randomUUID()}`))
  }

  private readSnapshot(directory: string, name: string): Snapshot {
    const value = JSON.parse(readPrivateFile(join(directory, 'snapshot.json'), 16_384) ?? 'null') as Snapshot | null
    if (!value || value.version !== 1 || value.profile !== name || typeof value.healthy !== 'boolean'
      || typeof value.created !== 'string' || !Number.isFinite(Date.parse(value.created)) || !value.files
      || Object.keys(value.files).length !== FILES.length || FILES.some(file => value.files[file] !== null
        && (typeof value.files[file]?.sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(value.files[file]!.sha256)))) {
      throw new Error('Invalid recovery backup')
    }
    return { ...value, reason: typeof value.reason === 'string' ? value.reason : 'unknown' }
  }
}
