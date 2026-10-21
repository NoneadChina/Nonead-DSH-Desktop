/** Strict `.env` support for the Host child process: fill in missing variables only. */
import { readFileSync } from 'node:fs'

/** One `KEY=VALUE` line; anything else is skipped with a warning. */
const LINE = /^([A-Za-z_][A-Za-z0-9_]*)[ \t]*=[ \t]*(.*)$/u

/** One `.env` file the Host inherits from. */
export interface EnvLayer {
  /** Absolute path of the file. */
  path: string
  /** What the file is for; warnings quote it, so it has to identify the file for a user. */
  label: string
}

/**
 * Parse one `.env` text the way a user expects and no shell would: `KEY=VALUE` only,
 * so there is no expansion, no escaping and no inline comment. Whole-line `#`
 * comments and blank lines are skipped, one matching pair of surrounding quotes is
 * removed, and the first assignment of a key wins so a duplicate cannot shadow it.
 * Every skipped line produces exactly one warning.
 * @param text - file contents; a leading byte-order mark is tolerated.
 * @param label - source name quoted in warnings.
 * @param warn - receives one message per skipped line.
 * @returns the variables this file defines.
 */
export function parseEnvFile(text: string, label: string, warn?: (message: string) => void): Record<string, string> {
  const values: Record<string, string> = {}
  const lines = text.replace(/^\uFEFF/u, '').split(/\r\n|[\r\n]/u)
  lines.forEach((raw, index) => {
    const line = raw.trim()
    if (!line || line.startsWith('#')) return
    const match = LINE.exec(line)
    if (!match) {
      warn?.(`Ignoring ${label} line ${index + 1}: expected KEY=VALUE`)
      return
    }
    const value = unquote(match[2]!.trim())
    if (value === undefined) {
      warn?.(`Ignoring ${label} line ${index + 1}: unbalanced quotes`)
      return
    }
    // The first assignment wins: a later duplicate is ignored rather than applied.
    if (!Object.hasOwn(values, match[1]!)) values[match[1]!] = value
  })
  return values
}

/**
 * Remove one matching pair of surrounding quotes.
 * @returns the unquoted value, or undefined when a quote is never closed.
 */
function unquote(value: string): string | undefined {
  const quote = value[0]
  if (quote !== '"' && quote !== "'") return value
  if (value.length < 2 || value[value.length - 1] !== quote) return undefined
  return value.slice(1, -1)
}

/**
 * Read one `.env` file. A missing file is the normal case and stays silent; an
 * unreadable one is reported and contributes nothing.
 * @param path - absolute file path.
 * @param label - source name quoted in warnings.
 * @param warn - receives the warnings.
 */
export function readEnvFile(path: string, label: string, warn?: (message: string) => void): Record<string, string> {
  let text: string
  try { text = readFileSync(path, 'utf8') } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      warn?.(`Ignoring unreadable ${label} (${path}): ${String(error)}`)
    }
    return {}
  }
  return parseEnvFile(text, label, warn)
}

/**
 * Build the environment of the Host child process.
 *
 * The inherited environment always wins, and the files only fill in what is still
 * missing, so a variable set for real is never replaced by a file. `process.env`
 * itself is never touched: the caller gets a copy it can extend for the child.
 * @param base - the environment the Host would otherwise inherit.
 * @param layers - `.env` files, most specific first.
 * @param warn - receives unreadable-file and skipped-line warnings.
 */
export function withEnvFiles(base: NodeJS.ProcessEnv, layers: readonly EnvLayer[], warn?: (message: string) => void): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = { ...base }
  for (const layer of layers) {
    for (const [key, value] of Object.entries(readEnvFile(layer.path, layer.label, warn))) {
      // A real variable, or one an earlier layer already supplied, is never replaced.
      if (defined(environment, key)) continue
      environment[key] = value
    }
  }
  return environment
}

/** Windows keeps one variable per name whatever its case, so presence is case-insensitive there. */
function defined(environment: NodeJS.ProcessEnv, key: string): boolean {
  if (environment[key] !== undefined) return true
  return process.platform === 'win32' && Object.keys(environment).some(name => name.toUpperCase() === key.toUpperCase())
}
