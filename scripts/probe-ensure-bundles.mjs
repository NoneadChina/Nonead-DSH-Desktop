/**
 * Verify the `ensureBundles` rule against the copied Profile: append every shipped plugin
 * name that is missing from `dsh.profile.bundles`, preserving existing order.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const root = 'D:/MyProgram/GitLab/nonead-dsh-desktop-essentials'
const file = `${root}/temp/.dsh/profiles/desktop/package.json`
const manifest = JSON.parse(readFileSync(`${root}/plugin/manifest.json`, 'utf8'))
const names = manifest.plugins.map(p => p.name)

const before = JSON.parse(readFileSync(file, 'utf8'))
const beforeBundles = before.dsh?.profile?.bundles ?? []
console.log(`before: deps=${Object.keys(before.dependencies ?? {}).length} bundles=${beforeBundles.length}`)

const present = new Set(beforeBundles)
const missing = names.filter(n => !present.has(n))
console.log(`missing from bundles: ${missing.length}`)

before.dsh = { ...before.dsh, profile: { ...before.dsh.profile, bundles: [...beforeBundles, ...missing] } }
writeFileSync(file, `${JSON.stringify(before, null, 2)}\n`)

const after = JSON.parse(readFileSync(file, 'utf8'))
const afterBundles = after.dsh.profile.bundles
console.log(`after : deps=${Object.keys(after.dependencies ?? {}).length} bundles=${afterBundles.length}`)
const stillMissing = names.filter(n => !afterBundles.includes(n))
console.log(`plugins still missing from bundles: ${stillMissing.length}`)
console.log(`sample tail: ${afterBundles.slice(-4).join(', ')}`)
