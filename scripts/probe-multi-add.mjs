/**
 * Probe: does one `add` call with several specs register every one of them in
 * `dsh.profile.bundles`? The Market treats a package without a bundle entry as disabled,
 * and the wizard adds all 27 at once.
 */
import { readFileSync } from 'node:fs'
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

const before = snapshot()
console.log('before deps =', before.deps.length, 'bundles =', before.bundles.length)

const specs = [
  `file:${root}/plugin/dsh-rewind-plugin-0.19.1.tgz`,
  `file:${root}/plugin/dsh-github-skills-0.2.1.tgz`,
]

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
  lockWaitMs: 300000,
  onOutput: text => process.stdout.write(text),
})

console.log('\nexitCode =', result.exitCode)
const after = snapshot()
console.log('after  deps =', after.deps.length, 'bundles =', after.bundles.length)
for (const name of ['dsh-rewind-plugin', 'dsh-github-skills']) {
  const inDeps = after.deps.includes(name)
  const inBundles = after.bundles.includes(name)
  console.log(`  ${name.padEnd(22)} dependencies=${inDeps}  bundles=${inBundles}`)
}
