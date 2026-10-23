/**
 * Runtime self-update for the two bundled markets.
 *
 * Both markets are ordinary Profile bundles, so a newer release only has to win the bundle
 * resolution that `profiles.ts` already performs through `<home>/profiles/node_modules`. This
 * module owns everything before that projection: the catalogue, the digest check, the archive
 * extraction, and the version switch with a rollback slot.
 *
 * Trust model: the catalogue is fetched over HTTPS from nonead.com and every entry pins a SHA-256
 * and a byte length. Nothing is extracted before both match, and an extracted package must name
 * itself and the advertised version before it can become active. A failed switch leaves the
 * previous version active, so a broken release can never strand a user without a market.
 */
import { createHash, randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, normalize, resolve, sep } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { linkedPathTarget, removeLinkedPath, sameResolvedPath } from '../../dsh-plugin-desktop-beta/src/fs-links.ts'

/** Packages this store may replace. Anything else is a Profile plugin, not a bundled market. */
export const MARKET_STORE_PACKAGES = Object.freeze(['dsh-community-market', 'dshmarket'] as const)
export type MarketStorePackage = (typeof MARKET_STORE_PACKAGES)[number]

export const MARKET_CATALOG_URL = 'https://www.nonead.com/software/ndsh-desktop/market/catalog.json'
const MARKET_CATALOG_SCHEMA_VERSION = 1 as const
const MAX_CATALOG_BYTES = 256 * 1024
const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024
const MAX_EXTRACTED_BYTES = 256 * 1024 * 1024
const MAX_ARCHIVE_ENTRIES = 20_000
const ACTIVE_FILENAME = '.active'
const STAGING_DIRECTORY = '.staging'
const KEPT_VERSIONS = 2

const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/u
const SHA256_PATTERN = /^[0-9a-f]{64}$/u

/** One downloadable release. `url` is absolute HTTPS and `sha256` pins the archive bytes. */
export interface MarketRelease {
  readonly version: string
  readonly url: string
  readonly sha256: string
  readonly bytes: number
}

export interface MarketCatalog {
  readonly schemaVersion: typeof MARKET_CATALOG_SCHEMA_VERSION
  readonly packages: Readonly<Record<string, Readonly<Record<string, Omit<MarketRelease, 'version'>>>>>
}

function invalid(reason: string): never { throw new Error(`Market catalogue is invalid: ${reason}`) }

/** Parse and validate the catalogue. Unknown packages are rejected, not ignored. */
export function parseMarketCatalog(text: string): MarketCatalog {
  let value: unknown
  try { value = JSON.parse(text) } catch { invalid('not JSON') }
  if (typeof value !== 'object' || value === null) invalid('not an object')
  const catalog = value as { schemaVersion?: unknown, packages?: unknown }
  if (catalog.schemaVersion !== MARKET_CATALOG_SCHEMA_VERSION) invalid('unsupported schemaVersion')
  if (typeof catalog.packages !== 'object' || catalog.packages === null) invalid('no packages')
  const packages: Record<string, Record<string, Omit<MarketRelease, 'version'>>> = {}
  for (const [name, versions] of Object.entries(catalog.packages as Record<string, unknown>)) {
    if (!(MARKET_STORE_PACKAGES as readonly string[]).includes(name)) invalid(`unknown package ${name}`)
    if (typeof versions !== 'object' || versions === null) invalid(`${name} has no versions`)
    const entries: Record<string, Omit<MarketRelease, 'version'>> = {}
    for (const [version, release] of Object.entries(versions as Record<string, unknown>)) {
      if (!VERSION_PATTERN.test(version)) invalid(`${name} has an invalid version ${version}`)
      const entry = release as { url?: unknown, sha256?: unknown, bytes?: unknown } | null
      if (typeof entry !== 'object' || entry === null) invalid(`${name}@${version} is not an object`)
      if (typeof entry.url !== 'string' || !entry.url.startsWith('https://')) invalid(`${name}@${version} needs an https url`)
      if (typeof entry.sha256 !== 'string' || !SHA256_PATTERN.test(entry.sha256)) invalid(`${name}@${version} needs a sha256`)
      if (!Number.isSafeInteger(entry.bytes) || (entry.bytes as number) <= 0 || (entry.bytes as number) > MAX_ARCHIVE_BYTES) {
        invalid(`${name}@${version} has an impossible byte length`)
      }
      entries[version] = { url: entry.url, sha256: entry.sha256, bytes: entry.bytes as number }
    }
    packages[name] = entries
  }
  if (Object.keys(packages).length === 0) invalid('no packages')
  return { schemaVersion: MARKET_CATALOG_SCHEMA_VERSION, packages }
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

/** Fetch and validate the catalogue. */
export async function fetchMarketCatalog(fetcher: typeof fetch = fetch, url = MARKET_CATALOG_URL): Promise<MarketCatalog> {
  if (!url.startsWith('https://')) throw new Error('Market catalogue must be fetched over https')
  const text = Buffer.from(await fetchBytes(url, MAX_CATALOG_BYTES, fetcher)).toString('utf8')
  return parseMarketCatalog(text)
}

/**
 * Download, verify and stage one release, returning its directory.
 *
 * Nothing is written outside `<home>/market-store/<package>/.staging` until the digest and the
 * package identity both match, and the staged tree is renamed into place atomically.
 */
export async function stageMarketRelease(
  home: string,
  name: MarketStorePackage,
  release: MarketRelease,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const finalDirectory = versionDirectory(home, name, release.version)
  const existing = lstatSync(finalDirectory, { throwIfNoEntry: false })
  if (existing?.isDirectory()) return finalDirectory
  const archive = await fetchBytes(release.url, Math.min(release.bytes, MAX_ARCHIVE_BYTES), fetcher)
  if (archive.byteLength !== release.bytes) throw new Error(`Market download is ${archive.byteLength} bytes, expected ${release.bytes}`)
  const digest = sha256(archive)
  if (digest !== release.sha256) throw new Error(`Market download digest ${digest} does not match the catalogue`)
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
    rmSync(finalDirectory, { recursive: true, force: true })
    renameSync(root, finalDirectory)
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

/**
 * Point the Profile's bundle resolution at the active store release.
 *
 * Without an active release nothing is projected, so the built-in bundle keeps loading — that is
 * also what a first run and a rolled-back install look like.
 */
export function projectMarketRelease(home: string, name: MarketStorePackage): string | undefined {
  const version = activeMarketVersion(home, name)
  if (version === undefined) return undefined
  const modules = join(home, 'profiles', 'node_modules')
  mkdirSync(modules, { recursive: true, mode: 0o700 })
  const link = marketProjectionPath(home, name)
  const target = versionDirectory(home, name, version)
  const existing = linkedPathTarget(link)
  if (existing !== undefined && sameResolvedPath(existing, target)) return link
  if (lstatSync(link, { throwIfNoEntry: false }) !== undefined) {
    // Only a link this module owns may be replaced; anything else is somebody's real package.
    if (existing === undefined) throw new Error(`Market projection ${link} is occupied by an unmanaged entry`)
    removeLinkedPath(link)
  }
  symlinkSync(target, link, 'junction')
  return link
}

/** Drop the projection so the next generation loads the built-in bundle again. */
export function retireMarketRelease(home: string, name: MarketStorePackage): void {
  const link = marketProjectionPath(home, name)
  if (linkedPathTarget(link) === undefined) return
  removeLinkedPath(link)
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
 * Fetch the catalogue and adopt every newer release this store owns.
 *
 * Each package is staged and verified before its pointer moves, so a failure leaves that package on
 * its current version. Callers decide whether to ask the user first; this function is the unchecked
 * step.
 */
export async function installMarketUpdates(
  home: string,
  fetcher: typeof fetch = fetch,
  catalogUrl = MARKET_CATALOG_URL,
): Promise<MarketUpdateResult> {
  const catalog = await fetchMarketCatalog(fetcher, catalogUrl)
  const applied: Array<{ name: MarketStorePackage, from: string | undefined, to: string }> = []
  const upToDate: MarketStorePackage[] = []
  for (const name of MARKET_STORE_PACKAGES) {
    const versions = catalog.packages[name] ?? {}
    const current = currentMarketVersion(home, name)
    const newest = Object.keys(versions).sort(compareMarketVersions).at(-1)
    if (newest === undefined || (current !== undefined && compareMarketVersions(newest, current) <= 0)) {
      upToDate.push(name)
      continue
    }
    await stageMarketRelease(home, name, { ...versions[newest]!, version: newest }, fetcher)
    activateMarketRelease(home, name, newest)
    projectMarketRelease(home, name)
    applied.push({ name, from: current, to: newest })
  }
  return { applied, upToDate }
}
