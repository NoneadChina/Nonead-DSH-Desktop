/** Next-owned profile state. Recovery works without importing any user plugin. */
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, symlinkSync, unlinkSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initProfile, loadOverlayPatches, loadProfileDirectory, PROFILE_TEMPLATES, readProfilePatches, type Profile, type ProfileContext } from '@deepseek-ai/dsh-app-boot'
import { withFileLock } from '@deepseek-ai/dsh-atomic-write'
import { atomicJson, atomicText, isLinkedPath, linkedPathTarget, readPrivateFile, removeLinkedPath, sameResolvedPath } from './private-files.ts'
import { existingPath, LEGACY, readPrivateFileWithLegacy } from './legacy-names.ts'
import { NextRecovery } from './recovery.ts'
import { DEFAULT_PROFILE } from './desktop-contract.ts'
import { computerUsePatch } from './profile-computer-use.ts'
import { RETIRED_SCHEDULE_BUNDLE, retiredSchedulePatch } from './profile-schedule.ts'
import { removeLinkProjectionsSafely } from '../../dsh-plugin-desktop-beta/src/link-projections.ts'
import { insideArchive, unpackedPath } from './asar-archive-policy.ts'
import { withProfileWriteLock } from './recovery-support.ts'

export const NEXT_PACKAGE = fileURLToPath(new URL('../package.json', import.meta.url))
export const WEB_BUNDLES = [...PROFILE_TEMPLATES.web!.bundles]
const NEXT_BUNDLE_PATCH = fileURLToPath(new URL('../cordis.patch.yml', import.meta.url))
export const AA_PACKAGE = '@agents-anywhere/dsh-bridge-next'
export const COMMUNITY_MARKET_PACKAGE = 'dsh-community-market'
export const DSH_MARKET_PACKAGE = 'dshmarket'
/** Legacy shell shape, now projected from the standard Profile bundle selection. */
export interface Features {
  remoteControl: boolean
  market: boolean
  dshMarket?: boolean
  /**
   * Which market the wizard chose, including "none": the two booleans above
   * cannot tell "the user skipped the market" apart from "dsh-market", so
   * reopening the wizard used to flip a skipped choice to dsh-market.
   */
  marketChoice?: 'none' | 'community' | 'dsh'
}
export interface OnboardingChoices { features: Features; computerUse: boolean }
export const DEFAULT_FEATURES: Readonly<Features> = { remoteControl: false, market: false }

interface ProfileManifest {
  dsh: {
    desktopNextPlugins?: number
    /**
     * Scheduled Tasks migration step: 1 carried 0.1.7 Web-row choices onto the
     * rc.2 optional bundle, 2 retired that bundle once upstream removed it.
     */
    desktopNextScheduleBundle?: number
    desktopNextOnboarding?: { version: number; outcome: 'completed' | 'skipped'; accountPending?: boolean }
    /** Which market the wizard chose, including "none"; mirrors `Features.marketChoice`. */
    desktopNextMarket?: 'none' | 'community' | 'dsh'
    /** Names recovery removed from `profile.bundles`; a UI ledger, never a policy. */
    desktopNextDeselectedBundles?: string[]
    profile: { bundles: string[] }
  }
  [key: string]: unknown
}

function applyFeatures(manifest: ProfileManifest, features: Features): void {
  const optional = [AA_PACKAGE, COMMUNITY_MARKET_PACKAGE, DSH_MARKET_PACKAGE]
  manifest.dsh.profile.bundles = [...manifest.dsh.profile.bundles.filter(name => !optional.includes(name)),
    ...(features.market ? [COMMUNITY_MARKET_PACKAGE] : []), ...(features.dshMarket ? [DSH_MARKET_PACKAGE] : []),
    ...(features.remoteControl ? [AA_PACKAGE] : [])]
  manifest.dsh.desktopNextPlugins = 1
  // Only record a choice we can trust: 'both false' means no choice yet (a fresh
  // setup must still default to dsh-market), and 'both true' cannot happen.
  if (features.marketChoice !== undefined) manifest.dsh.desktopNextMarket = features.marketChoice
  else if (Boolean(features.market) !== Boolean(features.dshMarket)) manifest.dsh.desktopNextMarket = features.market ? 'community' : 'dsh'
}

export function profileName(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/u.test(value)
    || /^(?:node_modules|con|prn|aux|nul|com[1-9]|lpt[1-9])$/iu.test(value)) {
    throw new Error('Profile 名称需为 1–64 个英文字母、数字、下划线或连字符，且不能是系统保留名称。')
  }
  return value
}

export function parseFeatures(value: unknown): Features {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Invalid Next features')
  const features = value as Record<string, unknown>
  if (typeof features.remoteControl !== 'boolean' || typeof features.market !== 'boolean'
    || (features.dshMarket !== undefined && typeof features.dshMarket !== 'boolean')
    || Object.keys(features).some(key => !['remoteControl', 'market', 'dshMarket', 'marketChoice'].includes(key))) throw new Error('Invalid Next features')
  const marketChoice = features.marketChoice
  if (marketChoice !== undefined && marketChoice !== 'none' && marketChoice !== 'community' && marketChoice !== 'dsh') throw new Error('Invalid Next features')
  return { remoteControl: features.remoteControl, market: features.market,
    ...(features.dshMarket !== undefined ? { dshMarket: features.dshMarket } : {}),
    ...(marketChoice === undefined ? {} : { marketChoice }) }
}

/**
 * Shell-owned Profile configuration.
 *
 * The Profile files are shared with the Host's profile manager, so every method
 * that reads configuration and writes it back runs under `withProfileWriteLock`
 * over `<profile>/lock.lock` — the same lock file the asynchronous recovery
 * writers take through `withFileLock(join(dir, 'lock'))`. Reads stay lock-free:
 * the atomic rename commit means a reader observes either the whole old or the
 * whole new file. Methods documented as "unlocked" assume the caller already
 * holds that lock, which is how a nested migration reuses one critical section.
 */
export class NextProfiles {
  constructor(readonly home: string) {
    if (!isAbsolute(home)) throw new Error('Next home must be absolute')
  }
  directory(name: string): string {
    const root = join(this.home, 'profiles')
    const dir = join(root, profileName(name))
    for (const path of [this.home, root, dir]) {
      if (existsSync(path) && (!lstatSync(path).isDirectory() || isLinkedPath(path))) {
        throw new Error(`Next profile path must be a real directory: ${path}`)
      }
    }
    return dir
  }
  get active(): string {
    const text = readPrivateFileWithLegacy(this.home, 'nonead-dsh-desktop.json', LEGACY.selection)
    if (text === undefined) return DEFAULT_PROFILE
    return profileName((JSON.parse(text) as { active?: unknown }).active)
  }
  select(name: string): void {
    if (!this.selectable(name)) throw new Error('Profile is unavailable for Desktop Next')
    atomicJson(join(this.home, 'nonead-dsh-desktop.json'), { version: 1, active: name })
  }
  /** Read configuration only; never load plugins just to render the native selector. */
  selectable(name: string): boolean {
    try {
      const value = JSON.parse(readPrivateFile(join(this.directory(name), 'package.json')) ?? 'null') as { dsh?: { profile?: { bundles?: unknown } } } | null
      const bundles = value?.dsh?.profile?.bundles
      this.features(name)
      return Array.isArray(bundles) && bundles.every(item => typeof item === 'string')
        && PROFILE_TEMPLATES.web!.bundles.every(bundle => bundles.includes(bundle))
    } catch { return false }
  }
  list(): string[] {
    const root = join(this.home, 'profiles')
    if (!existsSync(root)) return []
    return readdirSync(root, { withFileTypes: true }).filter(entry => {
      if (!entry.isDirectory()) return false
      try { return existsSync(join(this.directory(entry.name), 'package.json')) } catch { return false }
    }).map(entry => entry.name).sort()
  }
  ensure(name: string): string {
    const dir = this.directory(name)
    // Create the directory before locking, so a first-time Profile is already
    // covered by the shared writer lock while `initProfile` renders it.
    if (!existsSync(join(dir, 'package.json'))) mkdirSync(dir, { recursive: true, mode: 0o700 })
    return withProfileWriteLock(dir, () => this.writeEnsure(name, dir))
  }
  /** Unlocked: the caller holds the Profile writer lock. */
  private writeEnsure(name: string, dir: string): string {
    const existing = existsSync(join(dir, 'package.json'))
    if (!existing) initProfile(dir, WEB_BUNDLES)
    if (existing) {
      const manifest = this.manifest(name)
      if (manifest.dsh.profile.bundles.includes('nonead-dsh-desktop')) {
        // Retire the former Next-specific selection from the shared manifest.
        // Other launchers must not inherit this application's capability.
        new NextRecovery(this).backup(name, 'before-next-bundle-removal')
        this.writeMigrateFeatures(name)
        const migrated = this.manifest(name)
        migrated.dsh.profile.bundles = migrated.dsh.profile.bundles.filter(bundle => bundle !== 'nonead-dsh-desktop')
        atomicJson(join(dir, 'package.json'), migrated)
      }
    } else this.writeFeatures(name, DEFAULT_FEATURES)
    this.writeMigrateSchedule(name)
    return dir
  }
  create(name: string): string {
    const dir = this.directory(name)
    mkdirSync(dirname(dir), { recursive: true, mode: 0o700 })
    mkdirSync(dir, { mode: 0o700 })
    // The directory exists before the lock is taken, so a concurrent manager
    // contends on this Profile instead of racing the initial manifest render.
    return withProfileWriteLock(dir, () => {
      initProfile(dir, WEB_BUNDLES)
      this.writeFeatures(name, DEFAULT_FEATURES)
      this.writeMigrateSchedule(name)
      return dir
    })
  }
  features(name: string): Features {
    const manifest = this.manifest(name)
    if (manifest.dsh.desktopNextPlugins === 1 || !manifest.dsh.profile.bundles.includes('nonead-dsh-desktop')) {
      const bundles = manifest.dsh.profile.bundles
      return { remoteControl: bundles.includes(AA_PACKAGE), market: bundles.includes(COMMUNITY_MARKET_PACKAGE),
        ...(bundles.includes(DSH_MARKET_PACKAGE) ? { dshMarket: true } : {}),
        ...(manifest.dsh.desktopNextMarket === undefined ? {} : { marketChoice: manifest.dsh.desktopNextMarket }) }
    }
    const text = readPrivateFileWithLegacy(this.directory(name), 'nonead-dsh-desktop.features.json', LEGACY.features)
    return text === undefined ? { ...DEFAULT_FEATURES } : parseFeatures(JSON.parse(text))
  }
  setFeatures(name: string, value: unknown): void {
    const dir = this.directory(name)
    withProfileWriteLock(dir, () => this.writeFeatures(name, value))
  }
  /** Unlocked: the caller holds the Profile writer lock. */
  private writeFeatures(name: string, value: unknown): void {
    const features = parseFeatures(value)
    const manifest = this.manifest(name)
    applyFeatures(manifest, features)
    atomicJson(join(this.directory(name), 'package.json'), manifest)
  }
  onboardingRequired(name: string): boolean {
    const saved = this.manifest(name).dsh.desktopNextOnboarding
    return saved?.version !== 1 || !['completed', 'skipped'].includes(saved.outcome)
  }
  accountSetupPending(name: string): boolean {
    return !this.onboardingRequired(name) && this.manifest(name).dsh.desktopNextOnboarding?.accountPending === true
  }
  dismissAccountSetup(name: string): void {
    const dir = this.directory(name)
    withProfileWriteLock(dir, () => {
      const manifest = this.manifest(name)
      if (manifest.dsh.desktopNextOnboarding?.accountPending !== true) return
      delete manifest.dsh.desktopNextOnboarding.accountPending
      atomicJson(join(dir, 'package.json'), manifest)
    })
  }
  /** Read the saved native-provider choice without importing any user plugin. */
  computerUseEnabled(name: string): boolean {
    return computerUsePatch(readPrivateFile(join(this.directory(name), 'cordis.patch.yml')) ?? '[]\n').enabled
  }
  /** Save choices before completion. Skip preserves both bundles and the user's patch verbatim. */
  finishOnboarding(name: string, value?: unknown): void {
    const dir = this.directory(name)
    withProfileWriteLock(dir, () => this.writeOnboarding(name, dir, value))
  }
  /**
   * Unlocked: the caller holds the Profile writer lock, so the manifest read,
   * the patch read and the two-file commit cannot interleave with another writer.
   */
  private writeOnboarding(name: string, dir: string, value?: unknown): void {
    const manifest = this.manifest(name)
    const patchPath = join(dir, 'cordis.patch.yml')
    let originalPatch: string | undefined
    let nextPatch: string | undefined
    if (value !== undefined) {
      if (!value || typeof value !== 'object' || Array.isArray(value)
        || Object.keys(value).some(key => !['features', 'computerUse'].includes(key))) throw new Error('Invalid onboarding choices')
      const choices = value as Record<string, unknown>
      const features = parseFeatures(choices.features)
      if (features.market && features.dshMarket) throw new Error('Select only one plugin market')
      if (typeof choices.computerUse !== 'boolean') throw new Error('Invalid Computer Use choice')
      originalPatch = readPrivateFile(patchPath)
      nextPatch = computerUsePatch(originalPatch ?? '[]\n', choices.computerUse).text
      applyFeatures(manifest, features)
    }
    manifest.dsh.desktopNextOnboarding = { version: 1, outcome: value === undefined ? 'skipped' : 'completed',
      ...(value === undefined ? {} : { accountPending: true }) }
    const patchChanged = nextPatch !== undefined && nextPatch !== originalPatch
    if (patchChanged && nextPatch !== undefined) atomicText(patchPath, nextPatch)
    try {
      // Completion is the final write: a failed/interrupted save must never start the Host.
      atomicJson(join(dir, 'package.json'), manifest)
    } catch (error) {
      if (patchChanged) {
        if (originalPatch === undefined) unlinkSync(patchPath)
        else atomicText(patchPath, originalPatch)
      }
      throw error
    }
  }
  /** Once per Profile, preserve the old choices without overriding future plugin-manager edits. */
  migrateFeatures(name: string): void {
    const dir = this.directory(name)
    withProfileWriteLock(dir, () => this.writeMigrateFeatures(name))
  }
  /** Unlocked: the caller holds the Profile writer lock. */
  private writeMigrateFeatures(name: string): void {
    const manifest = this.manifest(name)
    if (manifest.dsh.desktopNextPlugins === 1) return
    this.writeFeatures(name, { ...this.features(name), dshMarket: manifest.dsh.profile.bundles.includes(DSH_MARKET_PACKAGE) })
  }
  /**
   * Once per Profile: upstream retired the Scheduled Tasks bundle and the Web
   * composition now mounts Schedule. Drop the bundle (app-boot would on load,
   * but Next reads the list first) and the `time-context` overrides that no
   * longer match a row; overrides on `schedule` and `ui-schedule` keep applying.
   * Unlocked: `ensure` and `create` call it while holding the Profile writer lock.
   */
  private writeMigrateSchedule(name: string): void {
    const manifest = this.manifest(name)
    if (manifest.dsh.desktopNextScheduleBundle === 2) return
    const patchPath = join(this.directory(name), 'cordis.patch.yml')
    let patch: string | undefined
    // A malformed patch is left for recovery to handle; retry on the next start.
    try { patch = retiredSchedulePatch(readPrivateFile(patchPath) ?? '[]\n') } catch { return }
    const bundles = manifest.dsh.profile.bundles.filter(bundle => bundle !== RETIRED_SCHEDULE_BUNDLE)
    if (patch !== undefined || bundles.length !== manifest.dsh.profile.bundles.length) {
      new NextRecovery(this).backup(name, 'before-schedule-bundle-retirement')
    }
    // Patch first: both steps are idempotent, so an interrupted run simply repeats.
    if (patch !== undefined) atomicText(patchPath, patch)
    manifest.dsh.profile.bundles = bundles
    manifest.dsh.desktopNextScheduleBundle = 2
    atomicJson(join(this.directory(name), 'package.json'), manifest)
  }
  private manifest(name: string): ProfileManifest {
    const value = JSON.parse(readPrivateFile(join(this.directory(name), 'package.json')) ?? 'null')
    if (!value || !Array.isArray(value.dsh?.profile?.bundles) || value.dsh.profile.bundles.some((item: unknown) => typeof item !== 'string')) throw new Error('Invalid Next Profile manifest')
    return value
  }
  /** The shell must stop this profile's Host before calling recovery. */
  async recover(name: string): Promise<string | undefined> {
    const dir = this.directory(name)
    mkdirSync(dir, { recursive: true, mode: 0o700 })
    return withFileLock(join(dir, 'lock'), async () => {
      const backup = new NextRecovery(this).backup(name, 'before-profile-repair')
      let manifest: Record<string, unknown> = { name, private: true }
      try {
        const value: unknown = JSON.parse(readPrivateFile(join(dir, 'package.json')) ?? '{}')
        if (value && typeof value === 'object' && !Array.isArray(value)) manifest = value as Record<string, unknown>
      } catch { /* The original bytes have already been backed up. */ }
      // Keep installed dependencies, but remove malformed activation metadata.
      const onboarding = (manifest.dsh as Partial<ProfileManifest['dsh']> | undefined)?.desktopNextOnboarding
      manifest.dsh = { profile: { bundles: WEB_BUNDLES },
        ...(onboarding?.version === 1 && ['completed', 'skipped'].includes(onboarding.outcome) ? { desktopNextOnboarding: onboarding } : {}) }
      atomicJson(join(dir, 'package.json'), manifest)
      atomicText(join(dir, 'cordis.patch.yml'), '[]\n')
      // Already inside the writer lock taken above, so write through the unlocked helper.
      this.writeFeatures(name, { remoteControl: false, market: false })
      return readPrivateFile(join(backup, 'cordis.patch.yml')) === undefined ? undefined : join(backup, 'cordis.patch.yml')
    })
  }
}

/**
 * Remove the package links a dsh 0.1.5 launcher (Stable before 2.0.14, the 0.1.5 CLI)
 * projected into this shared Profile. They point at that launcher's installation, so the
 * Host would load a second copy of every Harness package through them: a second
 * `dsh-scope` loses preset scope tags and new sessions fail with `agent-preset/invalid`.
 * Upstream sweeps them in `loadProfile`, which Next bypasses. A locked link must not keep
 * the Host from starting; the next launch retries.
 */
function retireLinkProjections(projectDir: string): void {
  try {
    removeLinkProjectionsSafely(projectDir)
  } catch (cause) {
    process.stderr.write(`nonead-dsh-desktop: could not remove dsh 0.1.5 link projections from ${projectDir}: ${String(cause)}\n`)
  }
}


/** Add product capabilities without replacing the upstream Web presentation. */
export function loadNextProfile(projectDir: string, home: string, installAnchor = NEXT_PACKAGE): Profile {
  const manager = new NextProfiles(home)
  if (manager.directory(basename(projectDir)) !== resolve(projectDir)) throw new Error('Profile must belong to Next home')
  manager.ensure(basename(projectDir))
  retireLinkProjections(projectDir)
  // Upstream bundle discovery walks physical node_modules before installing its
  // runtime resolver. Project only this application's bundle, not its dependency
  // tree; the alpha.2 runtime resolver owns all other package fallbacks. No
  // filesystem link can enter app.asar: a packaged application leaves the resolver
  // to supply its own package and removes a link a development launch left behind.
  const modules = join(home, 'profiles', 'node_modules')
  const existingModules = lstatSync(modules, { throwIfNoEntry: false })
  if (existingModules && !existingModules.isDirectory()) throw new Error('Next bundle fallback must be a real directory')
  mkdirSync(modules, { recursive: true, mode: 0o700 })
  const link = join(modules, 'nonead-dsh-desktop')
  const target = realpathSync(dirname(installAnchor))
  // Compare through `realpathSync.native`: a junction is invisible to `lstat` and `readlink`
  // throws EINVAL on it, so both would treat a planted junction as an unmanaged directory.
  const linkTarget = insideArchive(installAnchor) ? undefined : realpathSync.native(dirname(installAnchor))
  const existingLink = lstatSync(link, { throwIfNoEntry: false })
  const existingTarget = existingLink ? linkedPathTarget(link) : undefined
  if (existingLink && existingTarget === undefined) throw new Error('Next bundle fallback is occupied by an unmanaged package')
  if (existingLink && (linkTarget === undefined || existingTarget === undefined || !sameResolvedPath(existingTarget, linkTarget))) removeLinkedPath(link)
  if (linkTarget !== undefined && !lstatSync(link, { throwIfNoEntry: false })) symlinkSync(linkTarget, link, 'junction')
  const profile = loadProfileDirectory('nonead-dsh-desktop', projectDir, installAnchor)
  profile.layers.push({ packageName: 'nonead-dsh-desktop', packageDir: target,
    patchPaths: [NEXT_BUNDLE_PATCH], patches: loadOverlayPatches('nonead-dsh-desktop', NEXT_BUNDLE_PATCH) })
  const overlay = [
    { id: 'agents-anywhere-bridge-next', config: {
      dshHome: home,
      ...archivedAgentsAnywhereConfig(installAnchor),
    } },
  ]
  // Leave AA stateRoot unset to share its default credentials and device binding with Stable/Beta.
  // Rewriting the generated overlay also removes the former per-Profile stateRoot on upgrade.
  // The official manager still owns per-Profile bundle/row enablement.
  atomicJson(join(projectDir, 'nonead-dsh-desktop.cordis.patch.json'), overlay)
  return profile
}

/**
 * Paths the AA bridge cannot derive once it runs from app.asar: it copies its bundled Connector
 * project with `fs.cp` and spawns uv, and both need the copies unpacked beside the archive.
 * @param installAnchor - Next's package.json.
 * @returns Overrides for an archived installation; empty for a physical one.
 */
function archivedAgentsAnywhereConfig(installAnchor: string): { connectorSourceDir?: string; uvPath?: string } {
  if (!insideArchive(installAnchor)) return {}
  let packageDir: string
  try { packageDir = dirname(createRequire(installAnchor).resolve(`${AA_PACKAGE}/package.json`)) }
  catch { return {} /* The bridge is optional; without it there is nothing to redirect. */ }
  const config: { connectorSourceDir: string; uvPath?: string } = { connectorSourceDir: unpackedPath(join(packageDir, 'lib', 'bundled-connector')) }
  try {
    const uv = dirname(createRequire(join(packageDir, 'package.json')).resolve(`@dataiku/uv-${process.platform}-${process.arch}/package.json`))
    config.uvPath = unpackedPath(join(uv, 'bin', process.platform === 'win32' ? 'uv.exe' : 'uv'))
  } catch { /* No bundled uv for this platform; the bridge searches PATH as before. */ }
  return config
}

/** Recompose Next's own layer before user/global patches on every manager or HMR read. */
export function readNextProfilePatches(projectDir: string, home: string, overlays: readonly string[], profilePatches?: readonly Profile['patches'][number][]) {
  const profile = loadProfileDirectory('nonead-dsh-desktop', projectDir, NEXT_PACKAGE, { userLayer: false })
  profile.layers.push({ packageName: 'nonead-dsh-desktop', packageDir: dirname(NEXT_PACKAGE),
    patchPaths: [NEXT_BUNDLE_PATCH], patches: loadOverlayPatches('nonead-dsh-desktop', NEXT_BUNDLE_PATCH) })
  // A Profile created before the rename still carries its user layer under the legacy name,
  // and the boot path already reads it that way; both readers must see the same patches.
  const patchPath = existingPath(projectDir, basename(profile.patchPath), LEGACY.overlay)
  profile.patches = profilePatches === undefined
    ? existsSync(patchPath) ? loadOverlayPatches('nonead-dsh-desktop', patchPath) : []
    : [...profilePatches]
  const context: ProfileContext = { name: basename(projectDir), dir: projectDir, patchPath: profile.patchPath,
    installAnchor: NEXT_PACKAGE, cwd: process.cwd(), home, startedBundles: profile.layers.map(layer => layer.packageName),
    overlays: overlays.flatMap(path => loadOverlayPatches('nonead-dsh-desktop', path)),
    telemetryDisabledEnv: process.env.DSH_TELEMETRY_DISABLED }
  return readProfilePatches('nonead-dsh-desktop', context, profile)
}
