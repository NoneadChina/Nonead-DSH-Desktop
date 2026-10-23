/**
 * Pack the bundled markets into npm-style archives for an offline mirror.
 *
 * The Desktop no longer reads a self-hosted catalogue: a newer release is discovered on the
 * market's GitHub releases and its bytes come from the npm registry (see market-store.ts). These
 * archives stay useful for air-gapped installs, and they reproduce a release byte for byte.
 *
 * Output layout:
 *   <out>/<package>/<package>-<version>.tgz
 *
 * The archives are npm-style: every entry lives under a `package/` prefix, which is what
 * `market-store.ts` expects. Nothing is compressed beyond gzip, and entries are sorted so two runs
 * over the same tree produce the same bytes.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SKIP_DIRECTORIES = new Set(['node_modules', '.git', '.yarn', 'tests', 'coverage'])

/** Packages these archives may carry, with how each package directory is located. */
export const MARKET_PACKAGES = ['dsh-community-market', 'dshmarket']

function packageDirectory(name) {
  if (name === 'dsh-community-market') return join(root, name)
  // `dshmarket` is a dependency of the Beta workspace, not of the repository root.
  try {
    return dirname(createRequire(join(root, 'dsh-plugin-desktop-beta', 'package.json')).resolve(`${name}/package.json`))
  } catch { return undefined }
}

/** Directory prefixes declared by `files`, or `undefined` to walk the whole package. */
function declaredPrefixes(manifest) {
  if (!Array.isArray(manifest.files)) return undefined
  const prefixes = []
  for (const entry of manifest.files) {
    if (typeof entry !== 'string') continue
    const prefix = entry.replace(/\/\*\*.*$/u, '').replace(/\/\*$/u, '').replace(/^\.\//u, '')
    if (prefix.length > 0 && !prefix.includes('*')) prefixes.push(prefix)
    else if (prefix.length === 0) return undefined
  }
  return prefixes.length > 0 ? prefixes : undefined
}

function collectFiles(directory, prefixes) {
  const files = []
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      if (entry.name.startsWith('.')) continue
      const absolute = join(current, entry.name)
      const relativePath = absolute.slice(directory.length + 1).split(sep).join('/')
      if (entry.isDirectory()) {
        if (SKIP_DIRECTORIES.has(entry.name)) continue
        walk(absolute)
        continue
      }
      if (!entry.isFile()) continue
      if (prefixes !== undefined && !prefixes.some(prefix => relativePath === prefix || relativePath.startsWith(`${prefix}/`))) continue
      files.push({ relativePath, absolute })
    }
  }
  walk(directory)
  return files
}

function tarHeader(name, size) {
  const header = Buffer.alloc(512)
  header.write(name.slice(0, 100), 0, 'utf8')
  header.write('0000644\0', 100)
  header.write('0000000\0', 108)
  header.write('0000000\0', 116)
  header.write(`${size.toString(8).padStart(11, '0')}\0`, 124)
  header.write('00000000000\0', 136)
  header.write('        ', 148)
  header.write('0', 156)
  header.write('ustar\0', 257)
  header.write('00', 263)
  let sum = 0
  for (const byte of header) sum += byte
  header.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148)
  return header
}

/** Build an npm-style `package/`-prefixed tar.gz from the given files. */
export function packPackage(directory, files, manifest) {
  const chunks = []
  const entries = [
    { name: 'package/package.json', body: readFileSync(join(directory, 'package.json')) },
    ...files.map(file => ({ name: `package/${file.relativePath}`, body: readFileSync(file.absolute) })),
  ]
  for (const entry of entries) {
    if (entry.name.length > 100) throw new Error(`Archive path is too long for ustar: ${entry.name}`)
    if (entry.name === `package/package.json`) continue
    chunks.push(tarHeader(entry.name, entry.body.length), entry.body, Buffer.alloc((512 - (entry.body.length % 512)) % 512))
  }
  // package.json is first anyway; keep a deterministic order (already sorted by name).
  const head = entries[0]
  chunks.unshift(tarHeader(head.name, head.body.length), head.body, Buffer.alloc((512 - (head.body.length % 512)) % 512))
  chunks.push(Buffer.alloc(1024))
  return gzipSync(Buffer.concat(chunks), { level: 9 })
}

function digest(bytes) { return createHash('sha256').update(bytes).digest('hex') }

/**
 * Pack every selected package into `<out>/<package>/<package>-<version>.tgz`.
 * @param options - `{ outDir, packages }`.
 * @returns One entry per packed archive.
 */
export function publishMarket({ outDir, packages = MARKET_PACKAGES }) {
  const packed = []
  for (const name of packages) {
    const directory = packageDirectory(name)
    const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
    if (manifest.name !== name) throw new Error(`${name}/package.json says ${String(manifest.name)}`)
    if (typeof manifest.version !== 'string' || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(manifest.version)) {
      throw new Error(`${name} has an unpublished version ${String(manifest.version)}`)
    }
    const bytes = packPackage(directory, collectFiles(directory, declaredPrefixes(manifest)), manifest)
    const target = join(outDir, name)
    mkdirSync(target, { recursive: true })
    const archive = join(target, `${name}-${manifest.version}.tgz`)
    writeFileSync(archive, bytes)
    packed.push({ name, version: manifest.version, archive, bytes: bytes.length, sha256: digest(bytes) })
    process.stdout.write(`${name}@${manifest.version} -> ${archive} (${bytes.length} bytes, sha256 ${digest(bytes)})\n`)
  }
  return packed
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const option = (flag) => { const index = args.indexOf(flag); return index === -1 ? undefined : args[index + 1] }
  const outDir = resolve(option('--out') ?? join(root, 'market-release'))
  const only = args.filter(arg => MARKET_PACKAGES.includes(arg))
  publishMarket({ outDir, packages: only.length > 0 ? only : MARKET_PACKAGES })
}
