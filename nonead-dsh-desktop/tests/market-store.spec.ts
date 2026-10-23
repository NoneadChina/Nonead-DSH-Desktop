import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanupDisposableTree } from '../../dsh-plugin-desktop-beta/src/disposable-tree.ts'
import {
  activateMarketRelease,
  activeMarketVersion,
  compareMarketVersions,
  extractTarGz,
  installMarketUpdates,
  installedMarketVersions,
  parseGitHubRelease,
  parseNpmManifest,
  projectMarketRelease,
  retireMarketRelease,
  rollbackMarketRelease,
  stageMarketRelease,
  type MarketRelease,
} from '../src/market-store.ts'

const PACKAGE = 'dshmarket'
const temporaryRoots: string[] = []

afterEach(() => {
  // The projection is a junction, so the shared link-aware cleanup removes it instead of its target.
  for (const root of temporaryRoots.splice(0)) cleanupDisposableTree(root)
})

function home(): string {
  const directory = mkdtempSync(join(tmpdir(), 'market-store-'))
  temporaryRoots.push(directory)
  return directory
}

function tarHeader(name: string, size: number, type: string): Buffer {
  const header = Buffer.alloc(512)
  header.write(name.slice(0, 100), 0, 'utf8')
  header.write('0000644\0', 100)
  header.write('0000000\0', 108)
  header.write('0000000\0', 116)
  header.write(`${size.toString(8).padStart(11, '0')}\0`, 124)
  header.write('00000000000\0', 136)
  header.write('        ', 148)
  header.write(type, 156)
  header.write('ustar\0', 257)
  header.write('00', 263)
  let sum = 0
  for (const byte of header) sum += byte
  header.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148)
  return header
}

/** Build a npm-style tar.gz; `type` '2' produces a symlink entry with its target as body. */
function tarGz(entries: Array<{ name: string, body?: string, type?: string }>): Buffer {
  const chunks: Buffer[] = []
  for (const entry of entries) {
    const body = Buffer.from(entry.body ?? '', 'utf8')
    chunks.push(tarHeader(entry.name, entry.type === '5' || entry.type === '2' ? 0 : body.length, entry.type ?? '0'))
    if (entry.type !== '5' && body.length > 0) {
      chunks.push(body)
      chunks.push(Buffer.alloc((512 - (body.length % 512)) % 512))
    }
  }
  chunks.push(Buffer.alloc(1024))
  return gzipSync(Buffer.concat(chunks))
}

const GITHUB_RELEASE = JSON.stringify({
  tag_name: 'v1.69.0',
  html_url: 'https://github.com/dsh-market/dsh-market/releases/tag/v1.69.0',
  draft: false,
})
const NPM_INTEGRITY = `sha512-${'A'.repeat(86)}==`
const NPM_MANIFEST = JSON.stringify({
  name: 'dshmarket',
  version: '1.69.0',
  dist: { tarball: 'https://registry.npmjs.org/dshmarket/-/dshmarket-1.69.0.tgz', integrity: NPM_INTEGRITY },
})

describe('release discovery', () => {
  it('reads the version from the GitHub tag', () => {
    expect(parseGitHubRelease(GITHUB_RELEASE).version).toBe('1.69.0')
  })

  it('keeps the release page as the notes url', () => {
    expect(parseGitHubRelease(GITHUB_RELEASE).notesUrl).toBe('https://github.com/dsh-market/dsh-market/releases/tag/v1.69.0')
  })

  it('rejects a tag that is not a version', () => {
    expect(() => parseGitHubRelease(GITHUB_RELEASE.replace('v1.69.0', 'nightly'))).toThrow(/not a version/u)
  })

  it('rejects a draft release', () => {
    expect(() => parseGitHubRelease(GITHUB_RELEASE.replace('"draft":false', '"draft":true'))).toThrow(/draft/u)
  })

  it('reads the tarball and its integrity from the npm manifest', () => {
    const release = parseNpmManifest(NPM_MANIFEST, 'dshmarket', '1.69.0')
    expect(release.url).toBe('https://registry.npmjs.org/dshmarket/-/dshmarket-1.69.0.tgz')
    expect(release.integrity).toBe(NPM_INTEGRITY)
  })

  it('rejects a manifest for another version', () => {
    expect(() => parseNpmManifest(NPM_MANIFEST, 'dshmarket', '1.68.0')).toThrow(/version 1\.69\.0/u)
  })

  it('rejects a plain-http tarball', () => {
    expect(() => parseNpmManifest(NPM_MANIFEST.replace('https://registry.npmjs.org', 'http://registry.npmjs.org'), 'dshmarket', '1.69.0')).toThrow(/https/u)
  })

  it('rejects a manifest without a sha512 integrity', () => {
    expect(() => parseNpmManifest(NPM_MANIFEST.replace(NPM_INTEGRITY, 'sha1-deadbeef'), 'dshmarket', '1.69.0')).toThrow(/sha512 integrity/u)
  })
})

describe('archive extraction', () => {
  function archiveOf(entries: Array<{ name: string, body?: string, type?: string }>): Buffer { return tarGz(entries) }

  it('extracts a regular tree', () => {
    const root = home()
    extractTarGz(archiveOf([
      { name: 'package/package.json', body: '{"name":"dshmarket"}' },
      { name: 'package/lib', type: '5' },
      { name: 'package/lib/index.js', body: 'export default 1\n' },
    ]), root)
    expect(readFileSync(join(root, 'package', 'lib', 'index.js'), 'utf8')).toBe('export default 1\n')
  })

  it('refuses to escape the destination', () => {
    const root = home()
    expect(() => extractTarGz(archiveOf([{ name: '../escaped.js', body: 'x' }]), root)).toThrow(/escapes/u)
  })

  it('refuses an absolute entry', () => {
    const root = home()
    expect(() => extractTarGz(archiveOf([{ name: '/etc/passwd', body: 'x' }]), root)).toThrow(/absolute/u)
  })

  it('refuses a symlink entry', () => {
    const root = home()
    expect(() => extractTarGz(archiveOf([{ name: 'package/link', type: '2', body: '../../outside' }]), root)).toThrow(/link/u)
  })
})

describe('release staging and switching', () => {
  function releaseFor(version: string, archive: Buffer): MarketRelease {
    return { version, url: `https://example.test/${version}.tgz`, sha256: createHash('sha256').update(archive).digest('hex'), bytes: archive.byteLength }
  }

  function archiveFor(version: string): Buffer {
    return tarGz([
      { name: 'package/package.json', body: JSON.stringify({ name: PACKAGE, version }) },
      { name: 'package/lib/index.js', body: `export const version = '${version}'\n` },
    ])
  }

  it('stages, activates, projects and rolls back', async () => {
    const root = home()
    const first = archiveFor('1.69.0')
    const fetcher = (async () => new Response(new Uint8Array(first))) as unknown as typeof fetch
    await stageMarketRelease(root, PACKAGE, releaseFor('1.69.0', first), fetcher)
    activateMarketRelease(root, PACKAGE, '1.69.0')
    expect(activeMarketVersion(root, PACKAGE)).toBe('1.69.0')

    const links = projectMarketRelease(root, PACKAGE)
    expect(links.length).toBeGreaterThan(0)
    expect(readFileSync(join(links[0] as string, 'package.json'), 'utf8')).toContain('1.69.0')

    const second = archiveFor('1.70.0')
    await stageMarketRelease(root, PACKAGE, releaseFor('1.70.0', second), (async () => new Response(new Uint8Array(second))) as unknown as typeof fetch)
    activateMarketRelease(root, PACKAGE, '1.70.0')
    projectMarketRelease(root, PACKAGE)
    expect(activeMarketVersion(root, PACKAGE)).toBe('1.70.0')

    expect(rollbackMarketRelease(root, PACKAGE)).toBe('1.69.0')
    expect(activeMarketVersion(root, PACKAGE)).toBe('1.69.0')
    expect(installedMarketVersions(root, PACKAGE)).toContain('1.69.0')
  })

  it('rejects an archive whose digest does not match the catalogue', async () => {
    const root = home()
    const archive = archiveFor('1.69.0')
    const release = { ...releaseFor('1.69.0', archive), sha256: 'b'.repeat(64) }
    await expect(stageMarketRelease(root, PACKAGE, release, (async () => new Response(new Uint8Array(archive))) as unknown as typeof fetch))
      .rejects.toThrow(/digest/u)
  })

  it('orders releases above their own prereleases', () => {
    expect(compareMarketVersions('1.70.0', '1.69.0')).toBeGreaterThan(0)
    expect(compareMarketVersions('1.69.0', '1.69.0')).toBe(0)
    expect(compareMarketVersions('1.69.0-beta.1', '1.69.0')).toBeLessThan(0)
    expect(compareMarketVersions('2.0.0', '1.99.99')).toBeGreaterThan(0)
  })

  it('adopts a newer release discovered on GitHub and reports the transition', async () => {
    const root = home()
    const archive = archiveFor('1.70.0')
    const tarball = 'https://registry.npmjs.org/dshmarket/-/dshmarket-1.70.0.tgz'
    const integrity = `sha512-${createHash('sha512').update(archive).digest('base64')}`
    const fetcher = async (input: string | URL | Request): Promise<Response> => {
      const url = String(input)
      if (url.includes('api.github.com')) {
        return new Response(JSON.stringify({ tag_name: 'v1.70.0', html_url: 'https://github.com/dsh-market/dsh-market/releases/tag/v1.70.0', draft: false }))
      }
      if (url.endsWith('/dshmarket/1.70.0')) {
        return new Response(JSON.stringify({ name: PACKAGE, version: '1.70.0', dist: { tarball, integrity } }))
      }
      return new Response(new Uint8Array(archive))
    }
    const result = await installMarketUpdates(root, fetcher as unknown as typeof fetch)
    expect(result.applied).toHaveLength(1)
    expect(result.applied[0]?.to).toBe('1.70.0')
    expect(activeMarketVersion(root, PACKAGE)).toBe('1.70.0')
  })

  it('rejects an archive built for another version', async () => {
    const root = home()
    const archive = archiveFor('1.69.0')
    await expect(stageMarketRelease(root, PACKAGE, releaseFor('1.70.0', archive), (async () => new Response(new Uint8Array(archive))) as unknown as typeof fetch))
      .rejects.toThrow(/expected 1\.70\.0/u)
  })

  it('leaves the built-in bundle alone until a release is active', () => {
    const root = home()
    expect(projectMarketRelease(root, PACKAGE)).toEqual([])
    expect(retireMarketRelease(root, PACKAGE)).toBeUndefined()
  })

  it('projects into every profile and repins its manifest dependency', async () => {
    const root = home()
    const archive = archiveFor('1.69.0')
    await stageMarketRelease(root, PACKAGE, releaseFor('1.69.0', archive), (async () => new Response(new Uint8Array(archive))) as unknown as typeof fetch)
    activateMarketRelease(root, PACKAGE, '1.69.0')
    // A Profile that already ships the market: its own node_modules and its exact pin both outrank
    // the shared projection, so an upgrade that only touches the shared link changes nothing the
    // Host actually loads — the settings page keeps reporting the old version.
    const profile = join(root, 'profiles', 'desktop')
    mkdirSync(join(profile, 'node_modules', PACKAGE), { recursive: true })
    writeFileSync(join(profile, 'package.json'), JSON.stringify({ name: 'dsh-profile-desktop', dependencies: { [PACKAGE]: '1.66.45' } }), 'utf8')

    const links = projectMarketRelease(root, PACKAGE)

    expect(links).toHaveLength(2)
    expect(JSON.parse(readFileSync(join(profile, 'package.json'), 'utf8')).dependencies[PACKAGE]).toBe('1.69.0')
    expect(readFileSync(join(profile, 'node_modules', PACKAGE, 'package.json'), 'utf8')).toContain('1.69.0')
  })

  it('re-stages a version directory left empty by an interrupted switch', async () => {
    const root = home()
    const archive = archiveFor('1.69.0')
    // This is what a crashed switch leaves behind. Treating it as "already staged" hands the Host a
    // package with no manifest and no entry point, and the market then fails to activate.
    mkdirSync(join(root, 'market-store', PACKAGE, '1.69.0'), { recursive: true })

    await stageMarketRelease(root, PACKAGE, releaseFor('1.69.0', archive), (async () => new Response(new Uint8Array(archive))) as unknown as typeof fetch)

    const staged = join(root, 'market-store', PACKAGE, '1.69.0')
    expect(JSON.parse(readFileSync(join(staged, 'package.json'), 'utf8')).version).toBe('1.69.0')
    expect(readFileSync(join(staged, 'lib', 'index.js'), 'utf8')).toContain('1.69.0')
  })
})
