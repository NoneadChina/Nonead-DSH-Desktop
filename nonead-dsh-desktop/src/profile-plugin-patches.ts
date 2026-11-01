/**
 * Compatibility patches for third-party Profile plugins, applied before the Host loads them.
 *
 * `dsh-better-sidebar` declared the harness service `webRuntime`, which the 0.2.1-alpha host no
 * longer provides. Its host fiber therefore stays pending: `/sidebar/api/*` is never registered and
 * the static fallback answers those POSTs with 405. Rewriting the dependency to the surviving
 * `connection.isTrusted` fence — falling back to `webStartup.trustedHosts` plus the plugin's own
 * loopback check — restores the routes without touching any other plugin logic.
 *
 * The patch is deliberately narrow: it matches exact source text, writes a timestamped `.bak` next
 * to every file it rewrites, is idempotent, and never throws. A plugin that changes shape, gets
 * reinstalled, or is absent is simply left alone.
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Files rewritten in this run, and files deliberately left alone. */
export interface ProfilePluginPatchReport {
  readonly patched: readonly string[]
  readonly skipped: readonly string[]
}

const MARKER = '[local-fix]'

/** Every rewritten file keeps the previous bytes beside it. */
function backup(path: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const target = `${path}.bak-${stamp}`
  copyFileSync(path, target)
  return target
}

const OLD_LIB_INJECT = [
  'const inject = [',
  '\t"webServer",',
  '\t"sessions",',
  '\t"webRuntime",',
  '\t"tools"',
  '];',
].join('\n')
const NEW_LIB_INJECT = ['const inject = [', '\t"webServer",', '\t"sessions",', '\t"tools"', '];'].join('\n')

const OLD_LIB_FENCE = 'const fence = (req) => isTrustedApiRequest(req, ctx.webRuntime.trustedHosts);'
const NEW_LIB_FENCE = [
  'const fence = (req) => {',
  `\t// ${MARKER} 新宿主没有 webRuntime：改用 connection 的 Host/Origin 栅栏，`,
  '\t// 缺失时退回 webStartup.trustedHosts + 本文件自带的 loopback 校验。',
  '\tconst getService = (name) => (typeof ctx.get === "function" ? ctx.get(name) : void 0);',
  '\tconst connection = getService("connection");',
  '\tif (connection !== void 0 && typeof connection.isTrusted === "function") return connection.isTrusted(req);',
  '\tconst webStartup = getService("webStartup");',
  '\treturn isTrustedApiRequest(req, webStartup?.trustedHosts ?? []);',
  '};',
].join('\n')

const OLD_SRC_INJECT = "export const inject = ['webServer', 'sessions', 'webRuntime', 'tools']"
const NEW_SRC_INJECT = "export const inject = ['webServer', 'sessions', 'tools']"
const OLD_SRC_FENCE = 'const fence = (req: SidebarHttpRequest): boolean => isTrustedApiRequest(req, ctx.webRuntime.trustedHosts)'
const NEW_SRC_FENCE = [
  'const fence = (req: SidebarHttpRequest): boolean => {',
  '  // [local-fix] 新宿主没有 webRuntime：改用 connection 的 Host/Origin 栅栏。',
  "  const getService = (name: string): unknown => (typeof (ctx as { get?: unknown }).get === 'function'",
  '    ? (ctx as unknown as { get: (n: string) => unknown }).get(name)',
  '    : undefined)',
  "  const connection = getService('connection') as { isTrusted?: (r: SidebarHttpRequest) => boolean } | undefined",
  "  if (connection !== undefined && typeof connection.isTrusted === 'function') return connection.isTrusted(req)",
  "  const webStartup = getService('webStartup') as { trustedHosts?: string[] } | undefined",
  '  return isTrustedApiRequest(req, webStartup?.trustedHosts ?? [])',
  '}',
].join('\n')

/** Rewrite one file in place when every `replacements` pair matches; report what happened. */
function rewrite(path: string, replacements: readonly (readonly [string, string])[], patched: string[], skipped: string[]): boolean {
  if (!existsSync(path)) {
    skipped.push(`${path} (absent)`)
    return false
  }
  let text = readFileSync(path, 'utf8')
  if (text.includes(MARKER)) {
    skipped.push(`${path} (already patched)`)
    return false
  }
  let hits = 0
  for (const [from, to] of replacements) {
    if (!text.includes(from)) continue
    text = text.replace(from, to)
    hits++
  }
  // A partial match means the plugin changed shape: leave the file untouched rather than half-patch it.
  if (hits !== replacements.length) {
    skipped.push(`${path} (unexpected plugin source)`)
    return false
  }
  const saved = backup(path)
  writeFileSync(path, text, 'utf8')
  patched.push(`${path} (backup ${saved})`)
  return true
}

/**
 * Patch `dsh-better-sidebar` inside one Profile, if it is installed and still declares the removed
 * `webRuntime` service. Returns what was rewritten; never throws.
 */
export function patchBetterSidebar(profileDir: string, log: (message: string) => void = () => {}): ProfilePluginPatchReport {
  const patched: string[] = []
  const skipped: string[] = []
  try {
    const packageDir = join(profileDir, 'node_modules', 'dsh-better-sidebar')
    if (!existsSync(packageDir)) return { patched, skipped }
    rewrite(join(packageDir, 'lib', 'index.js'),
      [[OLD_LIB_FENCE, NEW_LIB_FENCE], [OLD_LIB_INJECT, NEW_LIB_INJECT]], patched, skipped)
    rewrite(join(packageDir, 'src', 'index.ts'),
      [[OLD_SRC_FENCE, NEW_SRC_FENCE], [OLD_SRC_INJECT, NEW_SRC_INJECT]], patched, skipped)
  } catch (error) {
    // A read-only or locked Profile must never stop the Host from starting.
    log(`profile plugin patch skipped: ${error instanceof Error ? error.message : String(error)}`)
  }
  return { patched, skipped }
}

/** Apply every known Profile plugin patch for the Profile at `profileDir`. Never throws. */
export function applyProfilePluginPatches(profileDir: string, log: (message: string) => void = () => {}): ProfilePluginPatchReport {
  const patched: string[] = []
  const skipped: string[] = []
  try {
    const betterSidebar = patchBetterSidebar(profileDir, log)
    patched.push(...betterSidebar.patched)
    skipped.push(...betterSidebar.skipped)
  } catch (error) {
    log(`profile plugin patches skipped: ${error instanceof Error ? error.message : String(error)}`)
  }
  return { patched, skipped }
}
