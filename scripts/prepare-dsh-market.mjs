/**
 * Keep the bundled market on a reviewed version.
 *
 * `market:check` (run by every build) is offline and only proves the committed manifests, the
 * resolution and the installed copies agree. `market:check --latest` additionally compares that
 * pin against the npm tag without touching the tree. Only `market:prepare` (explicit, human
 * driven) moves the pin, so a build can never adopt a freshly published release on its own.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const MARKET_WORKSPACES = ['dsh-plugin-desktop-beta', 'nonead-dsh-desktop']
export const marketResolution = version => `patch:dshmarket@npm%3A${version}#./.yarn/patches/dshmarket-desktop.patch`
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const registry = 'https://registry.npmjs.org/dshmarket/latest'

export async function latestMarket(fetcher = fetch) {
  const response = await fetcher(registry, { signal: AbortSignal.timeout(20_000), cache: 'no-store' })
  if (!response.ok) throw new Error(`dshmarket latest lookup failed: HTTP ${response.status}`)
  const manifest = await response.json()
  if (manifest.name !== 'dshmarket' || typeof manifest.version !== 'string'
    || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version)) {
    throw new Error('npm latest returned an invalid dshmarket identity/version')
  }
  return manifest.version
}

function installedVersion(directory, workspace) {
  try {
    const require = createRequire(join(directory, workspace, 'package.json'))
    return JSON.parse(readFileSync(require.resolve('dshmarket/package.json'), 'utf8')).version
  } catch { return undefined }
}

function install(directory) {
  const yarn = process.env.COREPACK_ROOT
    ? join(process.env.COREPACK_ROOT, 'dist', 'yarn.js') : process.env.npm_execpath
  if (!yarn || !/\.[cm]?js$/.test(yarn) || !existsSync(yarn)) {
    throw new Error('Run corepack yarn market:prepare to use the repository Yarn release')
  }
  const result = spawnSync(process.execPath, [yarn, 'install'], {
    cwd: directory, stdio: 'inherit', timeout: 600_000,
    env: { ...process.env, YARN_ENABLE_IMMUTABLE_INSTALLS: 'false' },
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`Market dependency install failed (${result.status})`)
}

/** The single `dshmarket@npm:<version>` resolution a checked-in tree must carry, if any. */
function pinnedVersion(rootManifest) {
  const keys = Object.keys(rootManifest.resolutions ?? {}).filter(key => key === 'dshmarket' || key.startsWith('dshmarket@'))
  if (keys.length !== 1) return undefined
  return /^dshmarket@npm:(.+)$/.exec(keys[0])?.[1]
}

export async function prepareMarket(directory, { check = false, latest = false, fetcher = fetch, runInstall = install } = {}) {
  const paths = ['package.json', ...MARKET_WORKSPACES.map(name => `${name}/package.json`), 'yarn.lock']
  const originals = new Map(paths.map(path => [path, readFileSync(join(directory, path))]))
  const manifests = new Map(paths.filter(path => path.endsWith('.json')).map(path =>
    [path, JSON.parse(originals.get(path).toString())]))
  const rootManifest = manifests.get('package.json')

  if (check) {
    // Offline by default: a build must be reproducible without asking npm which release is current.
    const pinned = pinnedVersion(rootManifest)
    if (pinned === undefined) throw new Error('no unambiguous dshmarket resolution; run corepack yarn market:prepare')
    const patchCurrent = rootManifest.resolutions[`dshmarket@npm:${pinned}`] === marketResolution(pinned)
    const stale = MARKET_WORKSPACES.filter(workspace =>
      manifests.get(`${workspace}/package.json`).dependencies?.dshmarket !== pinned
      || installedVersion(directory, workspace) !== pinned)
    if (stale.length || !patchCurrent) {
      throw new Error(`dshmarket ${pinned} is not consistent (${stale.join(', ') || 'stale resolution'}); run corepack yarn market:prepare`)
    }
    if (!latest) return pinned
    const available = await latestMarket(fetcher)
    if (available !== pinned) {
      throw new Error(`dshmarket latest is ${available} but the tree pins ${pinned}; run corepack yarn market:prepare to adopt it`)
    }
    return pinned
  }

  // Only the explicit command resolves the tag, and it writes nothing before that lookup succeeds.
  const version = await latestMarket(fetcher)
  const resolutionKey = `dshmarket@npm:${version}`
  const overrides = Object.keys(rootManifest.resolutions ?? {}).filter(key => key === 'dshmarket' || key.startsWith('dshmarket@'))
  const patchCurrent = overrides.length === 1 && rootManifest.resolutions[resolutionKey] === marketResolution(version)
  const stale = MARKET_WORKSPACES.filter(workspace =>
    manifests.get(`${workspace}/package.json`).dependencies?.dshmarket !== version
    || installedVersion(directory, workspace) !== version)
  if (!stale.length && patchCurrent) return version
  try {
    // Follow latest while retaining Desktop self-update and rollback fixes. Yarn rejects
    // incompatible patch contexts; never silently ship a new release without these safeguards.
    for (const key of overrides) delete rootManifest.resolutions[key]
    rootManifest.resolutions ??= {}
    rootManifest.resolutions[resolutionKey] = marketResolution(version)
    for (const workspace of MARKET_WORKSPACES) {
      const manifest = manifests.get(`${workspace}/package.json`)
      if (!manifest.dependencies?.dshmarket) throw new Error(`${workspace} must declare its bundled dshmarket`)
      manifest.dependencies.dshmarket = version
    }
    for (const [path, manifest] of manifests) writeFileSync(join(directory, path), `${JSON.stringify(manifest, null, 2)}\n`)
    runInstall(directory)
    for (const workspace of MARKET_WORKSPACES) {
      if (installedVersion(directory, workspace) !== version) throw new Error(`${workspace} did not install dshmarket ${version}`)
    }
  } catch (error) {
    for (const [path, bytes] of originals) writeFileSync(join(directory, path), bytes)
    throw new Error('Market preparation failed; manifests and lockfile restored. Rerun yarn install before continuing.', { cause: error })
  }
  return version
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2)
  if (args.some(arg => arg !== '--check' && arg !== '--latest')) {
    throw new Error('Usage: corepack yarn market:prepare [--check [--latest]]')
  }
  const check = args.includes('--check')
  const version = await prepareMarket(root, { check, latest: args.includes('--latest') })
  console.log(check
    ? `dshmarket ${version} is pinned consistently in ${MARKET_WORKSPACES.join(', ')}`
    : `dshmarket latest verified: ${version} in ${MARKET_WORKSPACES.join(', ')}`)
}
