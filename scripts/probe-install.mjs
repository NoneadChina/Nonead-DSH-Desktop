/**
 * Probe: reproduce the setup wizard's plugin install under the packaged executable.
 *
 * The wizard runs `process.execPath` (Electron) with the bundled pnpm entry. Electron only
 * behaves as Node when ELECTRON_RUN_AS_NODE is set, so this probe runs the same call twice:
 * without the variable (expected: nothing installed) and with it (expected: success).
 */
import { runPluginCommand } from '../nonead-dsh-desktop/node_modules/@deepseek-ai/dsh-plugin-manager/lib/types/operations.js'

const root = 'D:/MyProgram/GitLab/nonead-dsh-desktop-essentials'
const home = `${root}/temp/.dsh`
const profile = 'desktop'
const dir = `${home}/profiles/${profile}`
const pnpm = `${root}/nonead-dsh-desktop/.desktop-build/runtime/x64/primary-runtime/dependencies/pnpm/bin/pnpm.mjs`
const tgz = `${root}/plugin/dsh-find-plugins-0.3.0.tgz`
const electron = 'D:/Software/Nonead DSH Desktop/Nonead DSH Desktop.exe'

async function attempt(label, env) {
  console.log(`\n=== ${label} ===`)
  try {
    const result = await runPluginCommand({
      profile,
      home,
      dir,
      installAnchor: `${root}/nonead-dsh-desktop`,
      cwd: root,
    }, ['add', `file:${tgz}`], {
      execution: 'cli',
      command: electron,
      args: ['--expose-internals', pnpm],
      ...(env === undefined ? {} : { env }),
      outputBytes: 65536,
      lockWaitMs: 300000,
      onOutput: text => process.stdout.write(text),
    })
    console.log(`exitCode = ${result.exitCode}`)
  } catch (error) {
    console.log(`THREW: ${error instanceof Error ? error.message : String(error)}`)
  }
}

await attempt('without ELECTRON_RUN_AS_NODE', undefined)
await attempt('with ELECTRON_RUN_AS_NODE=1', { ELECTRON_RUN_AS_NODE: '1' })
