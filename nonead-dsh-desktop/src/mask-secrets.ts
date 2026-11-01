/** Mask secret-shaped substrings in a rendered log line. */

const MASK = '****'
const COOKIE_HEADER = /\b(Set-Cookie|Cookie)\s*:[^\r\n]*/giu
const AUTHORIZATION_HEADER = /\bAuthorization\s*:\s*([^\r\n]*)/giu
const WEB_URL = /https?:\/\/[^\s<>"']+/giu
const SENSITIVE_QUERY_KEY = /(?:auth|code|credential|key|password|secret|signature|token)/iu
const SECRET_FIELD_NAME = String.raw`access[_-]?token|(?:x[_-])?api[_-]?key|authorization|auth|client[_-]?secret|code|credential|id[_-]?token|(?:native|renderer)[_-]?token|password|passwd|private[_-]?key|refresh[_-]?token|secret|session(?:id)?|signature|token|x[_-]dsh[_-]desktop[_-]renderer`
const QUOTED_NAMED_SECRET = new RegExp(
  String.raw`(["'])(${SECRET_FIELD_NAME})\1(\s*:\s*)(["'])(?:\\.|(?!\4)[^\\])*\4`,
  'giu',
)
const NAMED_SECRET = new RegExp(
  String.raw`\b(${SECRET_FIELD_NAME})\b(\s*[:=]\s*)(?!(?:Bearer|Basic)\b)[^\s,;&]+`,
  'giu',
)

/**
 * A base64url run long enough to be a credential. The renderer credential is 32 random bytes,
 * which render as 43 characters of `[A-Za-z0-9_-]`; the old `[a-zA-Z0-9]{32,}` pattern could
 * never match it because base64url uses `-` and `_`.
 */
const BASE64URL_RUN = /(?<![A-Za-z0-9_-])[A-Za-z0-9_-]{32,}(?![A-Za-z0-9_-])/gu

/** Environment-style assignment of a hand-off credential: `DSH_NONEAD_NATIVE_TOKEN=…`. */
const ENV_SECRET_ASSIGNMENT = /\b([A-Z][A-Z0-9_]*_(?:TOKEN|SECRET|KEY))\s*=\s*([^\s,;&]+)/gu

/** A canonical UUID correlation id, which is an identifier and not a credential. */
const CANONICAL_UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu

/**
 * Whether a long base64url run looks like a credential rather than prose.
 *
 * A 32-byte base64url token carries a digit in ~99.99% of draws (1 − (52/64)^43) and an `_`
 * about half the time; requiring a digit/underscore or both letter cases keeps lowercase
 * hyphenated identifiers intact while still catching every generated credential.
 */
function looksRandom(run: string): boolean {
  return /[0-9_]/u.test(run) || (/[a-z]/u.test(run) && /[A-Z]/u.test(run))
}

/** Secret-shaped patterns applied in order to a rendered log line. */
const SECRET_PATTERNS: readonly RegExp[] = [
  /\bsk-[A-Za-z0-9]{12,}/gu, // OpenAI/DeepSeek-style sk- keys
  /Bearer\s+[A-Za-z0-9._-]+/giu, // Authorization bearer tokens
  /Basic\s+[A-Za-z0-9+/]+={0,2}/giu, // Authorization basic credentials
]

function maskUrl(raw: string): string {
  const trailing = /[),.;]+$/u.exec(raw)?.[0] ?? ''
  const value = trailing === '' ? raw : raw.slice(0, -trailing.length)
  try {
    const url = new URL(value)
    if (url.username !== '') url.username = MASK
    if (url.password !== '') url.password = MASK
    for (const name of url.searchParams.keys()) {
      if (SENSITIVE_QUERY_KEY.test(name)) url.searchParams.set(name, MASK)
    }
    return `${url.href}${trailing}`
  } catch {
    return raw
  }
}

/** Replace secret-shaped substrings, preserving a short leading prefix. */
export function maskSecrets(text: string): string {
  let out = text
    .replace(COOKIE_HEADER, (_match, name: string) => `${name}: ${MASK}`)
    .replace(WEB_URL, maskUrl)
    .replace(QUOTED_NAMED_SECRET, (_match, keyQuote: string, name: string, separator: string, valueQuote: string) =>
      `${keyQuote}${name}${keyQuote}${separator}${valueQuote}${MASK}${valueQuote}`)
    .replace(AUTHORIZATION_HEADER, (_match, value: string) => {
      const scheme = /^(Bearer|Basic)\b/iu.exec(value)?.[1]
      return `Authorization: ${scheme === undefined ? '' : `${scheme} `}${MASK}`
    })
    .replace(NAMED_SECRET, (_match, name: string, separator: string) => `${name}${separator}${MASK}`)
    .replace(ENV_SECRET_ASSIGNMENT, (_match, name: string) => `${name}=${MASK}`)
  // Long base64url runs are only masked when they look like a credential, so hyphenated
  // prose survives a log line that happens to mention one. UUID correlation ids are
  // identifiers rather than secrets and stay readable for log triage.
  out = out.replace(BASE64URL_RUN, run =>
    (looksRandom(run) && !CANONICAL_UUID.test(run) ? `${run.slice(0, 3)}${MASK}` : run))
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, (match) => {
      const authorizationScheme = /^(Bearer|Basic)/iu.exec(match)?.[1]
      if (authorizationScheme !== undefined) return `${authorizationScheme} ****`
      return `${match.slice(0, 3)}${MASK}`
    })
  }
  return out
}
