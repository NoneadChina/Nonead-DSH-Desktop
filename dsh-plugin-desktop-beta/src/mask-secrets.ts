/** Mask secret-shaped substrings in a rendered log line. */

const MASK = '****'
const COOKIE_HEADER = /\b(Set-Cookie|Cookie)\s*:[^\r\n]*/giu
const AUTHORIZATION_HEADER = /\bAuthorization\s*:\s*([^\r\n]*)/giu
const WEB_URL = /https?:\/\/[^\s<>"']+/giu
const SENSITIVE_QUERY_KEY = /(?:auth|code|credential|key|password|secret|signature|token)/iu
const SECRET_FIELD_NAME = String.raw`access[_-]?token|(?:x[_-])?api[_-]?key|authorization|auth|client[_-]?secret|credential|id[_-]?token|password|passwd|private[_-]?key|refresh[_-]?token|secret|session(?:id)?|signature|token`
/**
 * Structured documents may carry a `code` field (an OAuth code, an activation
 * code), so the quoted form masks it. The unquoted form is deliberately stricter:
 * it only matches unambiguous credential names, because prose diagnostics such as
 * `exit code: ENOENT` must stay readable in a failure report.
 */
const QUOTED_SECRET_FIELD_NAME = String.raw`code|${SECRET_FIELD_NAME}`
const QUOTED_NAMED_SECRET = new RegExp(
  String.raw`(["'])(${QUOTED_SECRET_FIELD_NAME})\1(\s*:\s*)(["'])(?:\\.|(?!\4)[^\\])*\4`,
  'giu',
)
const NAMED_SECRET = new RegExp(
  String.raw`\b(${SECRET_FIELD_NAME})\b(\s*[:=]\s*)(?!(?:Bearer|Basic)\b)([^\s,;&]+)`,
  'giu',
)

/**
 * Credential shapes that carry their own recognisable prefix. Each rule replaces
 * the whole token, prefix included, so no leading characters of a live secret
 * reach a log file or an exported diagnostics archive.
 */
const PREFIXED_CREDENTIALS: readonly RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{8,}/gu, // OpenAI/DeepSeek-style keys, including sk-proj-*
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{8,}/gu, // GitHub tokens
  /\bgithub_pat_[A-Za-z0-9_]{20,}/gu, // GitHub fine-grained token
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/gu, // AWS access key id
  /\b(?:xox[baprs]|xapp)-[A-Za-z0-9-]{8,}/gu, // Slack tokens
  /\bnpm_[A-Za-z0-9]{20,}/gu, // npm token
  /\bpypi-[A-Za-z0-9_-]{20,}/gu, // PyPI token
  /\bglpat-[A-Za-z0-9_-]{16,}/gu, // GitLab personal access token
]

/** Scheme-prefixed authorization values keep only their scheme. */
const AUTHORIZATION_SCHEME = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/giu

/** A JSON Web Token is three base64url segments separated by dots. */
const JSON_WEB_TOKEN = /\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/gu

/** Long high-entropy runs that were previously masked by a blanket length rule. */
const LONG_OPAQUE_TOKEN = /\b[A-Za-z0-9+/]{40,}={0,2}\b/gu

/** Diagnostic identifiers that must stay readable in a failure report. */
const DIAGNOSTIC_VALUE = /^(?:0[xX][0-9a-fA-F]+|[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*|\d+)$/u

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

/**
 * Replace secret-shaped substrings while preserving diagnostic codes.
 *
 * The masking boundary is the only thing standing between a credential and a
 * durable log file, so every rule here errs towards replacement. Values that are
 * plainly diagnostics (`ENOENT`, `0xC0000005`, a bare number) are exempted so a
 * failure report stays actionable.
 * @param text - one rendered log line.
 * @returns the line with credential-shaped substrings replaced by `****`.
 */
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
    .replace(NAMED_SECRET, (_match, name: string, separator: string, value: string) =>
      DIAGNOSTIC_VALUE.test(value) ? `${name}${separator}${value}` : `${name}${separator}${MASK}`)
  for (const pattern of PREFIXED_CREDENTIALS) out = out.replace(pattern, MASK)
  out = out
    .replace(JSON_WEB_TOKEN, MASK)
    .replace(AUTHORIZATION_SCHEME, (_match, scheme: string) => `${scheme} ${MASK}`)
    .replace(LONG_OPAQUE_TOKEN, MASK)
  return out
}
