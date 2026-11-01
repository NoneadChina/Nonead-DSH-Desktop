/**
 * Probe: add every bundled plugin in one call and report how many landed in
 * `dsh.profile.bundles`. The wizard adds all of them at once, and a package missing from
 * that list is treated as disabled by the Market even though its dependency is installed.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { runPluginCommand } from '../nonead-dsh-desktop/node_modules/@deepseek-ai/dsh-plugin-manager/lib/types/operations.js'

const root = 'D:/MyProgram/GitLab/nonead-dsh-desktop-essentials'
const home = `${root}/temp/.dsh`
const profile = 'desktop'
const dir = `${home}/profiles/${profile}`
const pnpm = `${root}/nonead-dsh-desktop/.desktop-build/runtime/x64/primary-runtime/dependencies/pnpm/bin/pnpm.mjs`

function snapshot() {
  const decoded = JSON.parse(readFileSync(`${dir}/package.json`, 'utf8'))
  return {
    deps: Object.keys(decoded.dependencies ?? {}),
    bundles: decoded.dsh?.profile?.bundles ?? [],
  }
}

const manifest = JSON.parse(readFileSync(`${root}/plugin/manifest.json`, 'utf8'))
const specs = manifest.plugins.map(p => `file:${root}/plugin/${p.file}`)
const names = manifest.plugins.map(p => p.name)

const before = snapshot()
console.log(`before: deps=${before.deps.length} bundles=${before.bundles.length}`)
console.log(`adding ${specs.length} specs in ONE call`)

const result = await runPluginCommand({
  profile,
  home,
  dir,
  installAnchor: `${root}/nonead-dsh-desktop`,
  cwd: root,
}, ['add', ...specs], {
  execution: 'cli',
  command: process.execPath,
  args: ['--expose-internals', pnpm],
  env: { ELECTRON_RUN_AS_NODE: '1' },
  outputBytes: 65536,
  lockWaitMs: 600000,
  onOutput: text => process.stdout.write(text),
})

console.log('\nexitCode =', result.exitCode)
const after = snapshot()
console.log(`after : deps=${after.deps.length} bundles=${after.bundles.length}`)
const missingDeps = names.filter(n => !after.deps.includes(n))
const missingBundles = names.filter(n => !after.bundles.includes(n))
console.log(`missing in dependencies: ${missingDeps.length}`)
console.log(`missing in bundles     : ${missingBundles.length}`)
if (missingBundles.length > 0) console.log('  ' + missingBundles.slice(0, 8).join(', ') + (missingBundles.length > 8 ? ' …' : ''))
