/**
 * Probe: does `--config.strictDepBuilds=false` let pnpm finish cleanly so the operation
 * proceeds to register `dsh.profile.bundles`?
 *
 * pnpm 11 reports packages with ignored build scripts via ERR_PNPM_IGNORED_BUILDS and exits
 * non-zero, which makes the plugin operation skip bundle registration entirely.
 */
import { readFileSync } from 'node:fs'
import { runPluginCommand } from '../nonead-dsh-desktop/node_modules/@deepseek-ai/dsh-plugin-manager/lib/types/operations.js'

const root = 'D:/MyProgram/GitLab/nonead-dsh-desktop-essentials'
const home = `${root}/temp/.dsh`
const profile = 'desktop'
const dir = `${home}/profiles/${profile}`
const pnpm = `${root}/nonead-dsh-desktop/.desktop-build/runtime/x64/primary-runtime/dependencies/pnpm/bin/pnpm.mjs`

function bundles() {
  const decoded = JSON.parse(readFileSync(`${dir}/package.json`, 'utf8'))
  return decoded.dsh?.profile?.bundles ?? []
}

const targets = [
  { name: 'dsh-image-gen', file: 'dsh-image-gen-0.10.0.tgz' },
  { name: 'dsh-univer-office', file: 'dsh-univer-office-0.3.9.tgz' },
]

async function attempt(label, extra) {
  const before = bundles().length
  console.log(`\n=== ${label} (bundles before ${before})`)
  const result = await runPluginCommand({
    profile,
    home,
    dir,
    installAnchor: `${root}/nonead-dsh-desktop`,
    cwd: root,
  }, ['add', ...extra, ...targets.map(t => `file:${root}/plugin/${t.file}`)], {
    execution: 'cli',
    command: process.execPath,
    args: ['--expose-internals', pnpm],
    env: { ELECTRON_RUN_AS_NODE: '1' },
    outputBytes: 65536,
    lockWaitMs: 600000,
    onOutput: () => {},
  })
  const after = bundles()
  console.log(`exitCode = ${result.exitCode}   bundles ${before} -> ${after.length}`)
  for (const target of targets) console.log(`  ${target.name.padEnd(20)} in bundles: ${after.includes(target.name)}`)
}

await attempt('with strictDepBuilds=false', ['--config.strictDepBuilds=false'])
