/**
 * Compare every bundled plugin against the `latest` dist-tag on the npm registry.
 * Reports only entries whose latest version differs from the one inside the archive.
 */
import { readFileSync } from 'node:fs'

const manifest = JSON.parse(readFileSync('plugin/manifest.json', 'utf8'))
const rows = []

for (const plugin of manifest.plugins) {
  const path = plugin.name.replace('/', '%2F')
  try {
    const response = await fetch(`https://registry.npmjs.org/${path}/latest`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) {
      rows.push({ name: plugin.name, current: plugin.version, latest: undefined, note: `HTTP ${response.status}` })
      continue
    }
    const decoded = await response.json()
    rows.push({ name: plugin.name, current: plugin.version, latest: decoded.version, note: undefined })
  } catch (error) {
    rows.push({ name: plugin.name, current: plugin.version, latest: undefined, note: String(error).slice(0, 60) })
  }
}

const outdated = rows.filter(row => row.latest !== undefined && row.latest !== row.current)
const unknown = rows.filter(row => row.latest === undefined)

console.log(`检查 ${rows.length} 个插件`)
console.log(`有更新: ${outdated.length}`)
for (const row of outdated) console.log(`  ${row.name.padEnd(34)} ${row.current}  ->  ${row.latest}`)
if (unknown.length > 0) {
  console.log(`无法确认: ${unknown.length}`)
  for (const row of unknown) console.log(`  ${row.name.padEnd(34)} ${row.current}  (${row.note})`)
}
