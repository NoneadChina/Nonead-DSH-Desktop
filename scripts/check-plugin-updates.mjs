/**
 * Compare every bundled plugin against its npm dist-tag.
 * Reports only entries whose expected version differs from the one inside the archive.
 *
 * Most packages follow `latest`; the exceptions below are pinned for the same reason
 * `update-plugin-archives.mjs` pins them (runtime lockstep / same-name different product).
 */
import { readFileSync } from 'node:fs'

const PINNED = {
  '@deepseek-ai/dsh-tool-subagent': '0.2.2-rc.3',
  'dsh-ppt-master': '6.1.0',
}

const manifest = JSON.parse(readFileSync('plugin/manifest.json', 'utf8'))
const rows = []

for (const plugin of manifest.plugins) {
  const path = plugin.name.replace('/', '%2F')
  const pinned = PINNED[plugin.name]
  const url = pinned === undefined
    ? `https://registry.npmjs.org/${path}/latest`
    : `https://registry.npmjs.org/${path}/${pinned}`
  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) {
      // A pinned version that npm never published (dsh-ppt-master 6.1.0) is expected: the
      // local archive is the source of truth, so report it as current rather than unknown.
      const localOnly = pinned !== undefined && response.status === 404
      rows.push({ name: plugin.name, current: plugin.version, latest: localOnly ? plugin.version : undefined, pinned: pinned !== undefined, note: `HTTP ${response.status}` })
      continue
    }
    const decoded = await response.json()
    rows.push({ name: plugin.name, current: plugin.version, latest: decoded.version, pinned: pinned !== undefined, note: undefined })
  } catch (error) {
    rows.push({ name: plugin.name, current: plugin.version, latest: undefined, note: String(error).slice(0, 60) })
  }
}

const outdated = rows.filter(row => row.latest !== undefined && row.latest !== row.current)
const unknown = rows.filter(row => row.latest === undefined)

console.log(`检查 ${rows.length} 个插件（其中 ${rows.filter(row => row.pinned).length} 个固定版本）`)
console.log(`有更新: ${outdated.length}`)
for (const row of outdated) console.log(`  ${row.name.padEnd(34)} ${row.current}  ->  ${row.latest}`)
if (unknown.length > 0) {
  console.log(`无法确认: ${unknown.length}`)
  for (const row of unknown) console.log(`  ${row.name.padEnd(34)} ${row.current}  (${row.note})`)
}
