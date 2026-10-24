/**
 * Renderer-to-Host package identity for a plugin the catalog does not list yet.
 *
 * This module is dependency-free on purpose: the browser bundle and the Host
 * both import it, so the Renderer rejects a malformed entry with the same rules
 * the Host re-applies. Parsing only narrows the input to a bare npm package
 * name; the Host still resolves `latest` and verifies the DSH manifest before
 * any installation can be confirmed.
 */

/** Maximum npm package name length, including the scope. */
const MAX_PACKAGE_NAME_LENGTH = 214

/**
 * A bare npm package name, optionally scoped. Uppercase letters and URL,
 * filesystem, or version syntaxes are all rejected.
 *
 * This is deliberately the same grammar the Host re-applies before it touches
 * the registry (`install/service.ts`): a name must start with a lowercase
 * letter or digit and may contain only `-`, `.` and `_` after that. Accepting
 * more here would let the Renderer pass an identity the Host then refuses,
 * which the user would only see as a generic "verification failed".
 */
const PACKAGE_NAME_PATTERN = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/

/** `name@1.2.3` and `@scope/name@next`: a pin the market cannot honor. */
const VERSION_PIN_PATTERN = /^(?:@[^/@]+\/)?[^@/]+@.+$/

/** Rejection reasons, rendered by the client through its own locale keys. */
export type MarketPluginSpecRejection =
  | 'empty'
  | 'too-long'
  | 'version-pinned'
  | 'invalid-name'

export type MarketPluginSpecParse =
  | { readonly ok: true; readonly packageName: string }
  | { readonly ok: false; readonly reason: MarketPluginSpecRejection }

/**
 * Normalize user input into the bare package name the Host may verify.
 * Only the registry's `latest` version can be installed, so a version pin is
 * reported instead of being silently dropped.
 */
export function parseMarketPluginSpec(input: unknown): MarketPluginSpecParse {
  if (typeof input !== 'string') return { ok: false, reason: 'invalid-name' }
  const trimmed = input.trim()
  if (trimmed.length === 0) return { ok: false, reason: 'empty' }
  if (trimmed.length > MAX_PACKAGE_NAME_LENGTH) return { ok: false, reason: 'too-long' }
  if (VERSION_PIN_PATTERN.test(trimmed)) return { ok: false, reason: 'version-pinned' }
  if (!PACKAGE_NAME_PATTERN.test(trimmed)) return { ok: false, reason: 'invalid-name' }
  return { ok: true, packageName: trimmed }
}
