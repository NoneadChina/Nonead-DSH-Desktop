/**
 * Install the plugins the installer ships into a freshly set-up Profile.
 *
 * `plugin/manifest.json` lists every bundled plugin and the directory holding its
 * `package.json`. Installation goes through the same official operation `dsh plugin add`
 * uses, so pnpm mutation and bundle reconciliation stay in one place and the Market's
 * "installed" tab sees a normal Profile dependency it can disable or remove.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import { runPluginCommand } from '@deepseek-ai/dsh-plugin-manager/operations'
import { bundledPnpmEntry } from './extensions.ts'
import { NEXT_PACKAGE } from './profiles.ts'

/** One plugin shipped beside the application. */
export interface BundledPlugin {
  readonly name: string
  readonly version: string
  /** Archive file name inside the bundled plugins directory. */
  readonly file: string
  /** What the plugin does, shown by the wizard while it installs. */
  readonly description?: string
}

export interface BundledPluginManifest {
  readonly count: number
  readonly plugins: readonly BundledPlugin[]
  /** Why the manifest is unusable, surfaced by the setup wizard when it shows no plugins. */
  readonly issue?: string
}

export interface InstalledBundledPlugins {
  readonly installed: readonly string[]
  readonly failed: readonly { readonly name: string; readonly error: string }[]
}

/** One install attempt's observable outcome. */
interface InstallOutcome {
  readonly exitCode: number
  readonly output: string
}

function isBundledPlugin(value: unknown): value is BundledPlugin {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.name === 'string' && record.name.length > 0
    && typeof record.version === 'string'
    && typeof record.file === 'string' && record.file.length > 0
}

/**
 * Read the bundled plugin manifest, never throwing: the wizard and the installer both need to
 * keep working when this build ships no plugins or the file is damaged. Whatever stopped the
 * read is reported in `issue` instead.
 * @param file - Absolute path to `manifest.json` beside the unpacked plugin archives.
 */
export function readBundledPlugins(file: string): BundledPluginManifest {
  if (!existsSync(file)) return { count: 0, plugins: [], issue: `manifest not found: ${file}` }
  try {
    const decoded: unknown = JSON.parse(readFileSync(file, 'utf8'))
    const plugins = (decoded as { plugins?: unknown }).plugins
    if (!Array.isArray(plugins)) return { count: 0, plugins: [], issue: 'manifest has no plugins array' }
    const valid = plugins.filter(isBundledPlugin)
    const malformed = plugins.length - valid.length
    return {
      count: valid.length,
      plugins: valid,
      ...(malformed === 0 ? {} : { issue: `${String(malformed)} of ${String(plugins.length)} manifest entries are malformed` }),
    }
  } catch (error) {
    return { count: 0, plugins: [], issue: `manifest unreadable: ${error instanceof Error ? error.message : String(error)}` }
  }
}

/**
 * Absolute `file:` specs for one plugins directory, in manifest order.
 * @param pluginDir - Directory holding the unpacked plugin trees and `manifest.json`.
 * @param manifest - Parsed manifest.
 */
export function bundledPluginSpecs(pluginDir: string, manifest: BundledPluginManifest): readonly { name: string; spec: string }[] {
  return manifest.plugins.map(plugin => ({
    name: plugin.name,
    spec: `file:${join(pluginDir, plugin.file)}`,
  }))
}

/** Structured counts behind the setup wizard's progress bar. */
export interface InstallProgress {
  readonly done: number
  readonly total: number
  readonly current?: string
}

/** Options shared by both install passes. */
export interface InstallBundledPluginsOptions {
  readonly pluginDir: string
  readonly manifest: BundledPluginManifest
  readonly profileName: string
  readonly profileDir: string
  readonly homeDir: string
  readonly cwd: string
  readonly signal?: AbortSignal
  /** Progress text plus counts, suitable for the Desktop log and the wizard's progress bar. */
  readonly onProgress?: (message: string, progress?: InstallProgress) => void
}

/**
 * Run one `dsh plugin add` pass.
 * @param options - Install context.
 * @param specs - Specs added by this pass.
 */
async function addPlugins(options: InstallBundledPluginsOptions, specs: readonly string[]): Promise<InstallOutcome> {
  const chunks: string[] = []
  const result = await runPluginCommand({
    profile: options.profileName,
    home: options.homeDir,
    dir: options.profileDir,
    installAnchor: NEXT_PACKAGE,
    cwd: options.cwd,
  }, ['add', '--config.strictDepBuilds=false', ...specs], {
    execution: 'cli',
    command: process.execPath,
    args: ['--expose-internals', bundledPnpmEntry(NEXT_PACKAGE)],
    // The packaged executable is Electron. Without this it starts a GUI process that ignores
    // the pnpm entry entirely and installs nothing, while exiting as if it had run.
    env: { ELECTRON_RUN_AS_NODE: '1' },
    outputBytes: 64 * 1024,
    lockWaitMs: 300_000,
    // A single plugin must never hang the wizard: bound each add, then report it as failed.
    signal: options.signal ?? AbortSignal.timeout(180_000),
    onOutput: (text) => {
      chunks.push(text)
      const tail = text.trim()
      if (tail.length > 0) options.onProgress?.(tail)
    },
  })
  return { exitCode: result.exitCode, output: chunks.join('').slice(-8000) }
}

/**
 * Dependency names currently recorded in a Profile manifest.
 * @param dir - Profile directory.
 */
function profileDependencies(dir: string): Set<string> {
  try {
    const decoded = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { dependencies?: Record<string, unknown> }
    return new Set(Object.keys(decoded.dependencies ?? {}))
  } catch {
    return new Set()
  }
}

/**
 * Record packages in `dsh.profile.bundles`, which is what makes a Profile actually load them.
 *
 * The official operation writes `dependencies` but does not reliably append to the bundle
 * list when many specs are added at once (and never for a spec already present), leaving
 * every plugin installed-but-disabled. Appending is the same shape the operation produces:
 * new bundles go after the existing ones.
 * @param dir - Profile directory.
 * @param names - Package names that must appear in the bundle list.
 */
function ensureBundles(dir: string, names: readonly string[]): void {
  const file = join(dir, 'package.json')
  const decoded = JSON.parse(readFileSync(file, 'utf8')) as { dsh?: { profile?: { bundles?: unknown } } }
  const profile = decoded.dsh?.profile ?? {}
  const bundles = Array.isArray(profile.bundles) ? (profile.bundles as string[]) : []
  const present = new Set(bundles)
  const missing = names.filter(name => !present.has(name))
  if (missing.length === 0) return
  decoded.dsh = { ...decoded.dsh, profile: { ...profile, bundles: [...bundles, ...missing] } }
  writeFileSync(file, `${JSON.stringify(decoded, null, 2)}\n`)
}

/**
 * Install every bundled plugin, preferring one pass and falling back to one plugin at a
 * time. The fallback exists because the operation rejects the whole run when any named
 * spec fails its compatibility preflight; a single bad plugin must not cost the rest.
 *
 * Success is judged from the Profile manifest rather than the exit code: the packaged
 * executable can exit 0 without running pnpm at all, which previously made a total failure
 * look like a clean install.
 * @param options - Install context.
 * @returns Which plugins installed and why the others did not.
 */
export async function installBundledPlugins(options: InstallBundledPluginsOptions): Promise<InstalledBundledPlugins> {
  if (!isAbsolute(options.pluginDir) || !isAbsolute(options.profileDir) || !isAbsolute(options.homeDir)) {
    throw new Error('bundled plugin installation requires absolute directories')
  }
  const entries = bundledPluginSpecs(options.pluginDir, options.manifest)
  if (entries.length === 0) return { installed: [], failed: [] }

  // Installed one at a time: the wizard shows a progress bar, one failing plugin must not
  // cost the rest, and each add registers its own bundle entry.
  const installed: string[] = []
  const failed: { name: string; error: string }[] = []
  for (const [index, entry] of entries.entries()) {
    options.signal?.throwIfAborted()
    options.onProgress?.(`installing ${entry.name}`, { done: index, total: entries.length, current: entry.name })
    try {
      const single = await addPlugins(options, [entry.spec])
      if (profileDependencies(options.profileDir).has(entry.name)) {
        installed.push(entry.name)
      } else {
        failed.push({ name: entry.name, error: single.output || `exit ${String(single.exitCode)} but the Profile was not updated` })
      }
    } catch (error) {
      failed.push({ name: entry.name, error: error instanceof Error ? error.message : String(error) })
    }
    options.onProgress?.(`${entry.name} handled`, { done: index + 1, total: entries.length, current: entry.name })
  }
  ensureBundles(options.profileDir, entries.map(entry => entry.name))
  return { installed, failed }
}
