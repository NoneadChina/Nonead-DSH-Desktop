/**
 * Runtime self-update for the two bundled markets.
 *
 * Both markets are ordinary Profile bundles, so a newer release only has to win the bundle
 * resolution that `profiles.ts` already performs through `<home>/profiles/node_modules`. This
 * module owns everything before that projection: resolving the published version, verifying and
 * extracting the archive, and the version switch with a rollback slot.
 *
 * The market cannot update itself through the host (the host unloads it before the reinstall runs,
 * and dshmarket's own `market-self-update` is refused there by design), so the desktop performs the
 * two steps from outside — which is exactly the missing entry point dshmarket documents.
 *
 * Trust model: the version comes from the market's GitHub release over HTTPS, and the bytes come
 * from the npm registry manifest, which pins a sha512 integrity. Nothing is extracted before that
 * digest matches, and an extracted package must name itself and the advertised version before it can
 * become active. A failed switch leaves the previous version active, so a broken release can never
 * strand a user without a market.
 */
import { createHash, randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { cpSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, normalize, resolve, sep } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { linkedPathTarget, removeLinkedPath, sameResolvedPath } from '../../dsh-plugin-desktop-beta/src/fs-links.ts'

/** Packages this store may replace. Anything else is a Profile plugin, not a bundled market. */
export const MARKET_STORE_PACKAGES = Object.freeze(['dsh-community-market', 'dshmarket'] as const)
export type MarketStorePackage = (typeof MARKET_STORE_PACKAGES)[number]

/**
 * Where a newer release of each bundled market is discovered and downloaded.
 *
 * The version is published on the market's own GitHub releases; the bytes come from the npm
 * registry, whose manifest pins the tarball with a sha512 integrity. `dsh-community-market` has no
 * release pipeline of its own yet, so it never self-updates.
 */
export const MARKET_RELEASE_SOURCES: Readonly<Record<MarketStorePackage, { readonly repo: string, readonly registry: string } | undefined>> = Object.freeze({
  'dsh-community-market': undefined,
  dshmarket: Object.freeze({ repo: 'dsh-market/dsh-market', registry: 'dshmarket' }),
})

const githubReleaseUrl = (repo: string): string => `https://api.github.com/repos/${repo}/releases/latest`
const npmManifestUrl = (registry: string, version: string): string => `https://registry.npmjs.org/${registry}/${version}`
const MAX_MANIFEST_BYTES = 256 * 1024
const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024
const MAX_EXTRACTED_BYTES = 256 * 1024 * 1024
const MAX_ARCHIVE_ENTRIES = 20_000
const ACTIVE_FILENAME = '.active'
const STAGING_DIRECTORY = '.staging'
const KEPT_VERSIONS = 2

const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/u
const SHA256_PATTERN = /^[0-9a-f]{64}$/u
const INTEGRITY_PATTERN = /^sha512-[A-Za-z0-9+/]+={0,2}$/u

/**
 * One downloadable release.
 *
 * A digest is mandatory but may arrive in either form: npm publishes a sha512 SRI, while an offline
 * mirror could still pin a plain sha256. `bytes` stays optional because the registry manifest records
 * `unpackedSize`, not the tarball length.
 */
export interface MarketRelease {
  readonly version: string
  readonly url: string
  readonly sha256?: string
  readonly integrity?: string
  readonly bytes?: number
  readonly notesUrl?: string
}

function invalid(reason: string): never { throw new Error(`Market release is invalid: ${reason}`) }

/** Read the newest published tag of a market repository. */
export function parseGitHubRelease(text: string): { readonly version: string, readonly notesUrl?: string } {
  let value: unknown
  try { value = JSON.parse(text) } catch { invalid('the GitHub release is not JSON') }
  if (typeof value !== 'object' || value === null) invalid('the GitHub release is not an object')
  const release = value as { tag_name?: unknown, html_url?: unknown, draft?: unknown }
  if (release.draft === true) invalid('the GitHub release is a draft')
  if (typeof release.tag_name !== 'string') invalid('the GitHub release has no tag')
  const version = release.tag_name.replace(/^v/u, '')
  if (!VERSION_PATTERN.test(version)) invalid(`the GitHub tag ${release.tag_name} is not a version`)
  return {
    version,
    ...(typeof release.html_url === 'string' && release.html_url.startsWith('https://') ? { notesUrl: release.html_url } : {}),
  }
}

/** Read one exact npm manifest and require a tarball plus the integrity that covers it. */
export function parseNpmManifest(text: string, name: string, version: string): MarketRelease {
  let value: unknown
  try { value = JSON.parse(text) } catch { invalid('the npm manifest is not JSON') }
  if (typeof value !== 'object' || value === null) invalid('the npm manifest is not an object')
  const manifest = value as { name?: unknown, version?: unknown, dist?: unknown }
  if (manifest.name !== name) invalid(`the npm manifest names ${String(manifest.name)}`)
  if (manifest.version !== version) invalid(`the npm manifest is version ${String(manifest.version)}`)
  const dist = manifest.dist
  if (typeof dist !== 'object' || dist === null) invalid(`${name}@${version} has no dist`)
  const { tarball, integrity } = dist as { tarball?: unknown, integrity?: unknown }
  if (typeof tarball !== 'string' || !tarball.startsWith('https://')) invalid(`${name}@${version} needs an https tarball`)
  if (typeof integrity !== 'string' || !INTEGRITY_PATTERN.test(integrity)) invalid(`${name}@${version} has no sha512 integrity`)
  return { version, url: tarball, integrity }
}

export function marketStoreRoot(home: string): string { return join(home, 'market-store') }
export function marketStorePackage(home: string, name: MarketStorePackage): string { return join(marketStoreRoot(home), name) }
function versionDirectory(home: string, name: MarketStorePackage, version: string): string {
  return join(marketStorePackage(home, name), version)
}

/** The version currently projected into the Profile, if any. */
export function activeMarketVersion(home: string, name: MarketStorePackage): string | undefined {
  const path = join(marketStorePackage(home, name), ACTIVE_FILENAME)
  try {
    const version = readFileSync(path, 'utf8').trim()
    if (!VERSION_PATTERN.test(version)) return undefined
    const info = lstatSync(versionDirectory(home, name, version), { throwIfNoEntry: false })
    return info?.isDirectory() ? version : undefined
  } catch { return undefined }
}

/** Every installed version, newest directory listing order is not meaningful — sort by name. */
export function installedMarketVersions(home: string, name: MarketStorePackage): string[] {
  try {
    return readdirSync(marketStorePackage(home, name), { withFileTypes: true })
      .filter(entry => entry.isDirectory() && VERSION_PATTERN.test(entry.name))
      .map(entry => entry.name)
      .sort()
  } catch { return [] }
}

function sha256(bytes: Uint8Array): string { return createHash('sha256').update(bytes).digest('hex') }
/** npm's Subresource-Integrity form for sha512, which is what a registry manifest publishes. */
function sha512Integrity(bytes: Uint8Array): string { return `sha512-${createHash('sha512').update(bytes).digest('base64')}` }

/**
 * Extract a npm-style tar.gz into `destination`, refusing anything that could escape it.
 *
 * Only regular files and directories are materialized: absolute paths, `..` segments, symlinks and
 * hard links are all rejected, so an archive cannot write outside the staging directory or plant a
 * link that a later write would follow.
 */
export function extractTarGz(archive: Uint8Array, destination: string): void {
  const tar = gunzipSync(archive)
  let offset = 0
  let extracted = 0
  let entries = 0
  let pendingName: string | undefined
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512)
    if (header.every(byte => byte === 0)) break
    const field = (start: number, length: number): string => {
      const slice = header.subarray(start, start + length)
      const end = slice.indexOf(0)
      return slice.subarray(0, end === -1 ? slice.length : end).toString('utf8')
    }
    const name = field(0, 100)
    const prefix = field(345, 155)
    const size = Number.parseInt(field(124, 12).trim() || '0', 8)
    const type = field(156, 1) || '0'
    if (!Number.isSafeInteger(size) || size < 0) throw new Error('Market archive has an invalid entry size')
    const body = tar.subarray(offset + 512, offset + 512 + size)
    if (body.length !== size) throw new Error('Market archive is truncated')
    offset += 512 + Math.ceil(size / 512) * 512

    if (type === 'x' || type === 'L') {
      // pax/long-name records carry the real path for the entry that follows.
      pendingName = type === 'L' ? body.toString('utf8').replace(/\0+$/u, '') : readPaxPath(body)
      continue
    }
    if (type === 'g' || type === 'K') continue
    const raw = pendingName ?? (prefix ? `${prefix}/${name}` : name)
    pendingName = undefined
    if (type === '5') {
      mkdirSync(inside(destination, raw), { recursive: true })
      continue
    }
    if (type !== '0' && type !== '7' && type !== '' && type !== '2' && type !== '1') {
      throw new Error(`Market archive entry ${raw} has an unsupported type ${type}`)
    }
    if (type === '2' || type === '1') throw new Error(`Market archive entry ${raw} is a link`)
    if (++entries > MAX_ARCHIVE_ENTRIES) throw new Error('Market archive has too many entries')
    extracted += size
    if (extracted > MAX_EXTRACTED_BYTES) throw new Error('Market archive expands beyond the size limit')
    const target = inside(destination, raw)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, body, { mode: 0o644 })
  }
}

function readPaxPath(body: Uint8Array): string {
  const text = Buffer.from(body).toString('utf8')
  const match = /(?:^|\n)\d+ path=([^\n]*)\n/u.exec(text)
  return match?.[1] ?? ''
}

/** Resolve `entry` under `root`, refusing absolute paths and any `..` escape. */
function inside(root: string, entry: string): string {
  const normalized = normalize(entry).replaceAll('\\', '/')
  if (normalized.startsWith('/') || isAbsolute(entry) || /^[A-Za-z]:/u.test(entry)) {
    throw new Error(`Market archive entry ${entry} is absolute`)
  }
  const target = resolve(root, normalized)
  const base = resolve(root)
  if (target !== base && !target.startsWith(base + sep)) throw new Error(`Market archive entry ${entry} escapes the staging directory`)
  return target
}

async function fetchBytes(url: string, limit: number, fetcher: typeof fetch): Promise<Uint8Array> {
  const response = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(120_000) })
  if (!response.ok) throw new Error(`Market download failed: HTTP ${response.status}`)
  const declared = Number(response.headers.get('content-length') ?? Number.NaN)
  if (Number.isSafeInteger(declared) && declared > limit) throw new Error('Market download exceeds the size limit')
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength > limit) throw new Error('Market download exceeds the size limit')
  return bytes
}

/** Resolve the newest published release of one bundled market, or `undefined` when it has no source. */
export async function latestMarketRelease(
  name: MarketStorePackage,
  fetcher: typeof fetch = fetch,
): Promise<MarketRelease | undefined> {
  const source = MARKET_RELEASE_SOURCES[name]
  if (source === undefined) return undefined
  const releaseText = Buffer.from(await fetchBytes(githubReleaseUrl(source.repo), MAX_MANIFEST_BYTES, fetcher)).toString('utf8')
  const release = parseGitHubRelease(releaseText)
  const manifestText = Buffer.from(await fetchBytes(npmManifestUrl(source.registry, release.version), MAX_MANIFEST_BYTES, fetcher)).toString('utf8')
  const manifest = parseNpmManifest(manifestText, source.registry, release.version)
  return release.notesUrl === undefined ? manifest : { ...manifest, notesUrl: release.notesUrl }
}

/** What a version check found, without downloading anything. */
export interface MarketUpdateCheck {
  readonly name: MarketStorePackage
  readonly current: string | undefined
  readonly latest: string
  readonly available: boolean
  readonly notesUrl?: string
}

/** Compare the active release of one market with what its source publishes. */
export async function checkMarketUpdate(
  home: string,
  name: MarketStorePackage,
  fetcher: typeof fetch = fetch,
): Promise<MarketUpdateCheck | undefined> {
  const latest = await latestMarketRelease(name, fetcher)
  if (latest === undefined) return undefined
  const current = currentMarketVersion(home, name)
  return {
    name,
    current,
    latest: latest.version,
    available: current === undefined || compareMarketVersions(latest.version, current) > 0,
    ...(latest.notesUrl === undefined ? {} : { notesUrl: latest.notesUrl }),
  }
}

/**
 * Download, verify and stage one release, returning its directory.
 *
 * Nothing is written outside `<home>/market-store/<package>/.staging` until the digest and the
 * package identity both match, and the staged tree is renamed into place atomically.
 */
/**
 * Is `directory` really a complete copy of `name@version`?
 *
 * A staged release is only usable if its manifest names the expected package and version and its
 * entry point actually exists. An interrupted switch can leave the version directory behind with
 * nothing in it; treating that as "already staged" hands the Host an empty package, which then fails
 * to resolve `<dir>/index.js` and the market never activates.
 */
function hasUsableRelease(directory: string, name: MarketStorePackage, version: string): boolean {
  try {
    const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')) as { name?: unknown, version?: unknown, main?: unknown }
    if (manifest.name !== name || manifest.version !== version) return false
    // The Host honors `main` when present and falls back to `index.js` when not, so completeness has
    // to be judged by the same rule the loader will use.
    const entry = typeof manifest.main === 'string' ? manifest.main : 'index.js'
    return lstatSync(join(directory, entry), { throwIfNoEntry: false })?.isFile() === true
  } catch { return false }
}

/**
 * Install the release's own runtime dependencies next to it.
 *
 * The npm archive ships code only, so a staged market would otherwise import packages the Profile
 * happens to have at whatever version it installed — `dshmarket` 1.69.0 wants `js-yaml@^4` and
 * `undici@^7` while a Profile built for 1.66.45 can easily hold `js-yaml@5`. Peer dependencies are
 * left to the Host, which already provides `cordis`, `dsh-settings` and `schemastery`.
 *
 * The market is a plain package, not a workspace member, so a dependency-local install is enough.
 */
function installReleaseDependencies(directory: string): void {
  // On Windows pnpm is a `.cmd` shim, and `execFileSync` does not append extensions.
  const pnpm = process.env.DSH_PNPM_PATH ?? (process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm')
  try {
    execFileSync(pnpm, ['install', '--prod', '--ignore-scripts', '--reporter=silent'], {
      cwd: directory,
      stdio: 'ignore',
      timeout: 180_000,
      windowsHide: true,
      // A `.cmd` shim only runs through the command processor.
      shell: process.platform === 'win32',
    })
  } catch (error) {
    throw new Error(`Market release dependencies could not be installed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export async function stageMarketRelease(
  home: string,
  name: MarketStorePackage,
  release: MarketRelease,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const finalDirectory = versionDirectory(home, name, release.version)
  const existing = lstatSync(finalDirectory, { throwIfNoEntry: false })
  if (existing?.isDirectory() && hasUsableRelease(finalDirectory, name, release.version)) return finalDirectory
  const archive = await fetchBytes(
    release.url,
    release.bytes === undefined ? MAX_ARCHIVE_BYTES : Math.min(release.bytes, MAX_ARCHIVE_BYTES),
    fetcher,
  )
  if (release.sha256 === undefined && release.integrity === undefined) {
    throw new Error(`Market release ${name}@${release.version} publishes no digest`)
  }
  if (release.bytes !== undefined && archive.byteLength !== release.bytes) {
    throw new Error(`Market download is ${archive.byteLength} bytes, expected ${release.bytes}`)
  }
  if (release.sha256 !== undefined) {
    const digest = sha256(archive)
    if (digest !== release.sha256) throw new Error(`Market download digest ${digest} does not match the published sha256`)
  }
  if (release.integrity !== undefined) {
    const integrity = sha512Integrity(archive)
    if (integrity !== release.integrity) throw new Error(`Market download integrity ${integrity} does not match the published integrity`)
  }
  const stagingRoot = join(marketStorePackage(home, name), STAGING_DIRECTORY)
  mkdirSync(stagingRoot, { recursive: true, mode: 0o700 })
  const staging = mkdtempSync(join(stagingRoot, `${release.version}-${randomUUID().slice(0, 8)}-`))
  try {
    extractTarGz(archive, staging)
    // npm archives wrap the tree in `package/`; accept that or a bare tree.
    const root = lstatSync(join(staging, 'package'), { throwIfNoEntry: false })?.isDirectory() ? join(staging, 'package') : staging
    const manifestPath = join(root, 'package.json')
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { name?: unknown, version?: unknown }
    if (manifest.name !== name) throw new Error(`Market archive contains ${String(manifest.name)}, expected ${name}`)
    if (manifest.version !== release.version) throw new Error(`Market archive contains version ${String(manifest.version)}, expected ${release.version}`)
    mkdirSync(dirname(finalDirectory), { recursive: true, mode: 0o700 })
    // Move any unusable leftover aside instead of deleting it first: deleting first means a failed
    // rename leaves an empty directory behind, and the next run would treat that as already staged.
    const retired = lstatSync(finalDirectory, { throwIfNoEntry: false }) === undefined
      ? undefined
      : `${finalDirectory}.invalid-${randomUUID()}`
    if (retired !== undefined) renameSync(finalDirectory, retired)
    try {
      renameSync(root, finalDirectory)
    } catch (error) {
      if (retired !== undefined) renameSync(retired, finalDirectory)
      throw error
    }
    if (retired !== undefined) rmSync(retired, { recursive: true, force: true })
    installReleaseDependencies(finalDirectory)
    return finalDirectory
  } finally {
    rmSync(staging, { recursive: true, force: true })
  }
}

/**
 * Make `version` the active release, keeping the previous one for rollback.
 *
 * The pointer file is replaced atomically, so an interrupted switch keeps the old version active.
 */
export function activateMarketRelease(home: string, name: MarketStorePackage, version: string): void {
  const directory = versionDirectory(home, name, version)
  if (!lstatSync(directory, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`Market release ${name}@${version} is not staged`)
  }
  const root = marketStorePackage(home, name)
  mkdirSync(root, { recursive: true, mode: 0o700 })
  const pointer = join(root, ACTIVE_FILENAME)
  const temporary = `${pointer}.${randomUUID()}.tmp`
  writeFileSync(temporary, `${version}\n`, { mode: 0o600 })
  renameSync(temporary, pointer)
  pruneMarketReleases(home, name)
}

/** Drop older releases, always keeping the active one and `KEPT_VERSIONS` rollback targets. */
function pruneMarketReleases(home: string, name: MarketStorePackage): void {
  const active = activeMarketVersion(home, name)
  const versions = installedMarketVersions(home, name)
  const keep = new Set(versions.filter(version => version !== active).sort().slice(-(KEPT_VERSIONS - 1)))
  if (active !== undefined) keep.add(active)
  for (const version of versions) {
    if (keep.has(version)) continue
    rmSync(versionDirectory(home, name, version), { recursive: true, force: true })
  }
}

/** The last installed version older than the active one, if any. */
export function previousMarketVersion(home: string, name: MarketStorePackage): string | undefined {
  const active = activeMarketVersion(home, name)
  if (active === undefined) return undefined
  return installedMarketVersions(home, name).filter(version => version !== active).sort().pop()
}

/** Switch back to the previous release and return the version now active. */
export function rollbackMarketRelease(home: string, name: MarketStorePackage): string | undefined {
  const previous = previousMarketVersion(home, name)
  if (previous === undefined) return undefined
  activateMarketRelease(home, name, previous)
  return previous
}

/** Where the Profile's bundle resolution looks for this package. */
export function marketProjectionPath(home: string, name: MarketStorePackage): string {
  return join(home, 'profiles', 'node_modules', name)
}

/** Profile directories that own a `node_modules` of their own (everything but the shared one). */
function profileDirectories(home: string): string[] {
  try {
    return readdirSync(join(home, 'profiles'), { withFileTypes: true })
      .filter(entry => entry.isDirectory() && entry.name !== 'node_modules')
      .map(entry => entry.name)
  } catch { return [] }
}

/**
 * Put a copy of the staged release at `<modulesDir>/<name>`.
 *
 * A copy, not a junction: Node resolves a junction to its real path, so the package would look for
 * its dependencies under `<home>/market-store/...` — where the archive's dependencies do not exist —
 * and never reach the ones the Profile installed next to it. Copying keeps the package inside the
 * Profile's `node_modules`, so its imports resolve exactly like any other installed bundle.
 *
 * A real directory that is already there is renamed rather than deleted: it is whatever the Profile
 * package manager installed, and an aborted upgrade must not destroy it.
 */
function projectInto(modulesDir: string, name: MarketStorePackage, target: string): string {
  mkdirSync(modulesDir, { recursive: true, mode: 0o700 })
  const destination = join(modulesDir, name)
  const existing = linkedPathTarget(destination)
  if (existing !== undefined && sameResolvedPath(existing, target)) return destination
  if (lstatSync(destination, { throwIfNoEntry: false }) !== undefined) {
    if (existing === undefined) renameSync(destination, `${destination}.pre-market-${randomUUID()}`)
    else removeLinkedPath(destination)
  }
  cpSync(target, destination, { recursive: true })
  return destination
}

/**
 * Point one Profile manifest at the new version.
 *
 * The Profile pins the market to an exact version, and that pin outranks any projection: leaving it
 * alone means the next install silently reverts the upgrade, and the settings page keeps reporting
 * the old version because the Host resolves through the Profile, not through the shared directory.
 */
function pinProfileDependency(profileDir: string, name: MarketStorePackage, version: string): void {
  const manifestPath = join(profileDir, 'package.json')
  let manifest: Record<string, unknown>
  try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown> } catch { return }
  const dependencies = manifest.dependencies
  if (dependencies === null || typeof dependencies !== 'object') return
  const pin = dependencies as Record<string, unknown>
  if (pin[name] === version) return
  pin[name] = version
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
}

/**
 * Point every Profile at the active store release.
 *
 * The shared `<home>/profiles/node_modules` projection is not enough on its own: each Profile owns a
 * `node_modules` and an exact version pin, and both of those win over the shared directory. An
 * upgrade that stops at the shared link therefore changes nothing the Host actually loads — the
 * settings page keeps reporting the old version and the new release never runs.
 *
 * Without an active release nothing is projected, so the built-in bundle keeps loading — that is
 * also what a first run and a rolled-back install look like.
 */
export function projectMarketRelease(home: string, name: MarketStorePackage): string[] {
  const version = activeMarketVersion(home, name)
  if (version === undefined) return []
  const target = versionDirectory(home, name, version)
  const links = [projectInto(join(home, 'profiles', 'node_modules'), name, target)]
  for (const profile of profileDirectories(home)) {
    const profileDir = join(home, 'profiles', profile)
    links.push(projectInto(join(profileDir, 'node_modules'), name, target))
    pinProfileDependency(profileDir, name, version)
  }
  return links
}

/** Drop the projection so the next generation loads the built-in bundle again. */
export function retireMarketRelease(home: string, name: MarketStorePackage): void {
  const directories = [
    join(home, 'profiles', 'node_modules'),
    ...profileDirectories(home).map(profile => join(home, 'profiles', profile, 'node_modules')),
  ]
  for (const modulesDir of directories) {
    const destination = join(modulesDir, name)
    if (linkedPathTarget(destination) !== undefined) { removeLinkedPath(destination); continue }
    // A projected release is a real directory now (a copy, so its imports resolve inside the
    // Profile), so it has to be removed like one.
    if (lstatSync(destination, { throwIfNoEntry: false }) !== undefined) rmSync(destination, { recursive: true, force: true })
  }
}

/** Compare two `x.y.z[-prerelease]` versions; a prerelease orders before its own release. */
export function compareMarketVersions(left: string, right: string): number {
  const split = (value: string): [number[], string | undefined] => {
    const [core = '', prerelease] = value.split('-', 2)
    return [core.split('.').map(part => Number.parseInt(part, 10)), prerelease]
  }
  const [leftCore, leftPre] = split(left)
  const [rightCore, rightPre] = split(right)
  for (let index = 0; index < 3; index++) {
    const difference = (leftCore[index] ?? 0) - (rightCore[index] ?? 0)
    if (difference !== 0) return difference
  }
  if (leftPre === rightPre) return 0
  if (leftPre === undefined) return 1
  if (rightPre === undefined) return -1
  return leftPre < rightPre ? -1 : 1
}

/** The version the Profile loads today: the runtime store first, then the built-in bundle. */
export function currentMarketVersion(home: string, name: MarketStorePackage): string | undefined {
  const active = activeMarketVersion(home, name)
  if (active !== undefined) return active
  try {
    const require = createRequire(import.meta.url)
    const manifest = JSON.parse(readFileSync(require.resolve(`${name}/package.json`), 'utf8')) as { version?: unknown }
    return typeof manifest.version === 'string' ? manifest.version : undefined
  } catch { return undefined }
}

export interface MarketUpdateResult {
  readonly applied: ReadonlyArray<{ readonly name: MarketStorePackage, readonly from: string | undefined, readonly to: string }>
  readonly upToDate: readonly MarketStorePackage[]
}

/**
 * Resolve every bundled market's newest release and adopt the newer ones.
 *
 * Each package is staged and verified before its pointer moves, so a failure leaves that package on
 * its current version. Callers decide whether to ask the user first; this function is the unchecked
 * step. A package with no release source is reported as up to date rather than failed.
 */
export async function installMarketUpdates(
  home: string,
  fetcher: typeof fetch = fetch,
): Promise<MarketUpdateResult> {
  const applied: Array<{ name: MarketStorePackage, from: string | undefined, to: string }> = []
  const upToDate: MarketStorePackage[] = []
  for (const name of MARKET_STORE_PACKAGES) {
    const current = currentMarketVersion(home, name)
    const release = await latestMarketRelease(name, fetcher)
    if (release === undefined || (current !== undefined && compareMarketVersions(release.version, current) <= 0)) {
      upToDate.push(name)
      continue
    }
    await stageMarketRelease(home, name, release, fetcher)
    activateMarketRelease(home, name, release.version)
    projectMarketRelease(home, name)
    applied.push({ name, from: current, to: release.version })
  }
  return { applied, upToDate }
}
