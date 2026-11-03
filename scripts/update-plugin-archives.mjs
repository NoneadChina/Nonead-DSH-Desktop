/**
 * Refresh every bundled plugin archive in `plugin/` to the npm `latest` dist-tag.
 *
 * `check-plugin-updates.mjs` only reports drift; this command is the explicit, human-driven
 * counterpart that actually moves the archives, mirroring how `market:prepare` is the only
 * thing allowed to move the bundled `dshmarket` pin.
 *
 * For every package listed in `plugin/manifest.json` it resolves the `latest` tag, downloads
 * that tarball when the bundled archive is missing or older, verifies the archive's own
 * `package/package.json` before replacing anything, and deletes the superseded archive so the
 * directory keeps exactly one version per package. `plugin/manifest.json` is rebuilt afterwards.
 *
 * Usage: corepack yarn plugins:update
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pluginDir = join(root, 'plugin')
const registry = 'https://registry.npmjs.org'
const ARCHIVE = /\.(?:tgz|tar\.gz)$/u

/** Minimal ustar reader, matching build-plugin-manifest.mjs (Windows bsdtar mishandles -O). */
function readTarMember(archive, target) {
  const buffer = gunzipSync(readFileSync(archive))
  let offset = 0
  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512)
    if (header.every(byte => byte === 0)) break
    const name = header.subarray(0, 100).toString('utf8').replace(/\0[\s\S]*$/u, '')
    const size = Number.parseInt(header.subarray(124, 136).toString('utf8').replace(/\0[\s\S]*$/u, '').trim(), 8) || 0
    const type = header[156]
    if ((type === 0 || type === 0x30) && name === target) {
      return buffer.subarray(offset + 512, offset + 512 + size).toString('utf8')
    }
    offset += 512 + Math.ceil(size / 512) * 512
  }
  return undefined
}

/** `@scope/name` + `1.2.3` → `scope-name-1.2.3.tgz`, the same shape the directory already uses. */
const archiveName = (name, version) => `${name.replace(/^@/u, '').replace(/\//gu, '-')}-${version}.tgz`

function archivedIdentity(file) {
  try {
    const raw = readTarMember(join(pluginDir, file), 'package/package.json')
    if (raw === undefined) return undefined
    const decoded = JSON.parse(raw)
    return { name: decoded.name, version: decoded.version }
  } catch { return undefined }
}

async function latest(name) {
  const response = await fetch(`${registry}/${name.replace('/', '%2F')}/latest`, {
    headers: { accept: 'application/json' }, signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

const manifest = JSON.parse(readFileSync(join(pluginDir, 'manifest.json'), 'utf8'))
const report = []

for (const plugin of manifest.plugins) {
  const entry = { name: plugin.name, from: plugin.version, to: undefined, action: 'unchanged', note: undefined }
  try {
    const meta = await latest(plugin.name)
    if (typeof meta.version !== 'string') throw new Error('latest has no version')
    entry.to = meta.version
    const targetFile = archiveName(meta.name ?? plugin.name, meta.version)
    const targetPath = join(pluginDir, targetFile)
    const existing = existsSync(targetPath) ? archivedIdentity(targetFile) : undefined
    if (existing && existing.name === plugin.name && existing.version === meta.version) {
      entry.action = 'present'
      report.push(entry)
      continue
    }
    const url = meta.dist?.tarball
    if (typeof url !== 'string') throw new Error('latest has no dist.tarball')
    const response = await fetch(url, { signal: AbortSignal.timeout(300_000) })
    if (!response.ok) throw new Error(`tarball HTTP ${response.status}`)
    const temporary = `${targetPath}.download`
    writeFileSync(temporary, Buffer.from(await response.arrayBuffer()))
    const identity = archivedIdentity(`${targetFile}.download`)
    if (!identity || identity.name !== plugin.name || identity.version !== meta.version) {
      unlinkSync(temporary)
      throw new Error(`downloaded archive identity mismatch (${JSON.stringify(identity)})`)
    }
    renameSync(temporary, targetPath)
    for (const file of readdirSync(pluginDir).filter(name => ARCHIVE.test(name) && name !== targetFile)) {
      const other = archivedIdentity(file)
      if (other && other.name === plugin.name) unlinkSync(join(pluginDir, file))
    }
    entry.action = entry.from === meta.version ? 'refreshed' : 'updated'
    report.push(entry)
  } catch (error) {
    entry.action = 'skipped'
    entry.note = error instanceof Error ? error.message : String(error)
    report.push(entry)
  }
}

const width = Math.max(...report.map(row => row.name.length))
for (const row of report) {
  const state = row.action === 'skipped' ? `SKIP ${row.note}`
    : row.action === 'present' || row.action === 'unchanged' ? 'unchanged'
      : `${row.action} ${row.from} -> ${row.to}`
  console.log(`${row.name.padEnd(width)}  ${state}`)
}
const updated = report.filter(row => row.action === 'updated' || row.action === 'refreshed').length
console.log(`\n${report.length} 个插件：${updated} 个更新，${report.length - updated - report.filter(r => r.action === 'skipped').length} 个已是最新，${report.filter(r => r.action === 'skipped').length} 个跳过`)

const rebuilt = spawnSync(process.execPath, [join(root, 'scripts', 'build-plugin-manifest.mjs')], { cwd: root, stdio: 'inherit' })
if (rebuilt.status !== 0) process.exitCode = rebuilt.status ?? 1
