import { describe, expect, it } from 'vitest'
import { maskSecrets } from '../src/mask-secrets.ts'

/**
 * Credentials that reach a log line or an exported diagnostics archive without a
 * secret-shaped *name* in front of them — a bare token in a message, a stack
 * frame, a response-body excerpt. `mask-secrets.ts` is the last redaction step
 * before those bytes are persisted, so each of these has to disappear.
 */

/** base64url of `{"sub":"user-1","iat":1700000000}`: the payload of a signed JWT. */
const JWT_PAYLOAD = 'eyJzdWIiOiJ1c2VyLTEiLCJpYXQiOjE3MDAwMDAwMDB9'
/** A signed JWT: header.payload.signature, all base64url. */
const JWT = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${JWT_PAYLOAD}.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c`

/** base64 of sha256("nonead-session-key-1"): 32 bytes of key material, so it carries `/`. */
const BASE64_KEY = 'mrFqJ/lt8n6E/kcQzBm3n7lI494kQ1lVbMvTqLOyJsY='

describe('maskSecrets: unnamed credentials', () => {
  it('masks every segment of a JWT, including the base64url signature', () => {
    const masked = maskSecrets(`[auth] request rejected for token ${JWT} (retrying)`)
    expect(masked).not.toContain(JWT_PAYLOAD)
    expect(masked).not.toContain('SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV')
    expect(masked).not.toContain('adQssw5c')
    expect(masked).toContain('****')
  })

  it('masks a base64 credential that contains a slash', () => {
    const masked = maskSecrets(`upload failed for key ${BASE64_KEY} after 2 attempts`)
    expect(masked).not.toContain(BASE64_KEY)
    expect(masked).not.toContain('kcQzBm3n7lI494kQ1lVbMvTqLOyJsY')
  })

  it('keeps UUID-shaped identities readable so log correlation still works', () => {
    const sessionId = 'ws-1-session-9f2c1a7e-3b44-4c10-9e55-7a1d2f6b8c30'
    expect(maskSecrets(`agent turn failed (session ${sessionId}, turn 1)`)).toContain(sessionId)
  })
})
