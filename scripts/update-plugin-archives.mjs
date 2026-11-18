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

/**
 * Packages that must not follow the `latest` dist-tag:
 *
 * - `@deepseek-ai/dsh-tool-subagent` ships in lockstep with the bundled dsh runtime, and its
 *   `latest` tag still points at the ancient 0.0.1-rc.1. Its peerDependencies pin the exact
 *   runtime version, so this entry moves only when `vendor/dsh-runtime` moves.
 * - `dsh-ppt-master` 6.1.0 is the locally maintained 6.x line. The npm package with the same
 *   name is a different product whose only published line is 1.0.x, so `latest` must never
 *   replace it.
 */
const PINNED = {
  '@deepseek-ai/dsh-tool-subagent': '0.2.2-rc.3',
  'dsh-ppt-master': '6.1.0',
}

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

async function packageMeta(name) {
  const pinned = PINNED[name]
  const path = name.replace('/', '%2F')
  const url = pinned === undefined ? `${registry}/${path}/latest` : `${registry}/${path}/${pinned}`
  const response = await fetch(url, {
    headers: { accept: 'application/json' }, signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const meta = await response.json()
  if (pinned !== undefined && meta.version !== pinned) {
    throw new Error(`pinned ${pinned} resolved to ${meta.version}`)
  }
  return meta
}

const manifest = JSON.parse(readFileSync(join(pluginDir, 'manifest.json'), 'utf8'))
const report = []

for (const plugin of manifest.plugins) {
  const entry = { name: plugin.name, from: plugin.version, to: undefined, action: 'unchanged', note: undefined }
  try {
    const pinned = PINNED[plugin.name]
    if (pinned !== undefined) {
      const pinnedFile = archiveName(plugin.name, pinned)
      const existingPinned = existsSync(join(pluginDir, pinnedFile)) ? archivedIdentity(pinnedFile) : undefined
      if (existingPinned && existingPinned.name === plugin.name && existingPinned.version === pinned) {
        entry.to = pinned
        entry.action = 'pinned'
        report.push(entry)
        continue
      }
    }
    const meta = await packageMeta(plugin.name)
    if (typeof meta.version !== 'string') throw new Error('dist-tag has no version')
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
    : row.action === 'pinned' ? `pinned ${row.to}`
      : row.action === 'present' || row.action === 'unchanged' ? 'unchanged'
        : `${row.action} ${row.from} -> ${row.to}`
  console.log(`${row.name.padEnd(width)}  ${state}`)
}
const updated = report.filter(row => row.action === 'updated' || row.action === 'refreshed').length
console.log(`\n${report.length} 个插件：${updated} 个更新，${report.length - updated - report.filter(r => r.action === 'skipped').length} 个已是最新，${report.filter(r => r.action === 'skipped').length} 个跳过`)

const rebuilt = spawnSync(process.execPath, [join(root, 'scripts', 'build-plugin-manifest.mjs')], { cwd: root, stdio: 'inherit' })
if (rebuilt.status !== 0) process.exitCode = rebuilt.status ?? 1
