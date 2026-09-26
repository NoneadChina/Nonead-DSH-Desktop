import { describe, expect, it } from 'vitest'
import { maskSecrets } from '../src/mask-secrets.ts'

describe('maskSecrets', () => {
  it('masks API key values together with their provider prefix', () => {
    // The prefix is not a secret, but keeping it identifies the credential family
    // and can be account-identifying, so the whole token is replaced.
    const masked = maskSecrets('key is sk-1234abcd5678')
    expect(masked).toBe('key is ****')
    expect(masked).not.toContain('sk-1234abcd')
  })

  it('masks bearer tokens in headers', () => {
    const masked = maskSecrets('Authorization: Bearer abc.def.ghi')
    expect(masked).toContain('Bearer ****')
    expect(masked).not.toContain('abc.def.ghi')
  })

  it('masks basic authorization credentials', () => {
    const masked = maskSecrets('Authorization: Basic dXNlcjpwYXNzd29yZA==')
    expect(masked).toBe('Authorization: Basic ****')
    expect(masked).not.toContain('dXNlcjpwYXNzd29yZA==')
  })

  it('masks cookie header values', () => {
    const masked = maskSecrets('Cookie: session=short-secret; theme=dark')
    expect(masked).toBe('Cookie: ****')
    expect(masked).not.toContain('short-secret')
  })

  it('masks URL userinfo and sensitive query values', () => {
    const masked = maskSecrets('GET https://user:pass@example.com/api?token=short&mode=fast')
    expect(masked).toBe('GET https://****:****@example.com/api?token=****&mode=fast')
    expect(masked).not.toContain('user:pass')
    expect(masked).not.toContain('token=short')
  })

  it('masks named secret fields even when their values are short', () => {
    const masked = maskSecrets('api_key=short password: hunter2 mode=fast')
    expect(masked).toBe('api_key=**** password: **** mode=fast')
    expect(masked).not.toContain('hunter2')
  })

  it('masks quoted secret fields in rendered JSON', () => {
    const masked = maskSecrets(JSON.stringify({
      api_key: 'short-secret',
      code: 'short-code',
      nested: {
        access_token: 'access123',
        authorization: 'custom-auth',
        password: 'hunter2',
        token: 'abc123',
        'x-api-key': 'short-key',
      },
      mode: 'fast',
    }))

    expect(masked).toBe('{"api_key":"****","code":"****","nested":{"access_token":"****","authorization":"****","password":"****","token":"****","x-api-key":"****"},"mode":"fast"}')
    expect(masked).not.toContain('short-secret')
    expect(masked).not.toContain('short-code')
    expect(masked).not.toContain('access123')
    expect(masked).not.toContain('custom-auth')
    expect(masked).not.toContain('short-key')
    expect(masked).not.toContain('hunter2')
    expect(masked).not.toContain('abc123')
  })

  it('leaves ordinary prose untouched', () => {
    expect(maskSecrets('hello world, profile "desktop"')).toBe('hello world, profile "desktop"')
  })

  it('preserves diagnostic codes in prose so failure reports stay actionable', () => {
    expect(maskSecrets('error code: ENOENT operation-in-progress'))
      .toBe('error code: ENOENT operation-in-progress')
    expect(maskSecrets('Profile dependency migration failed: exit code: EPERM'))
      .toBe('Profile dependency migration failed: exit code: EPERM')
    expect(maskSecrets('child process gone (reason: crashed, exitCode: 9 / 0x00000009)'))
      .toBe('child process gone (reason: crashed, exitCode: 9 / 0x00000009)')
  })

  it('masks prefixed credential families without leaking their prefix', () => {
    for (const secret of [
      'sk-proj-abcdefghijklmnopqrstuvwxyz',
      'ghp_abcdefghijklmnopqrstuvwxyz012345',
      'github_pat_11ABCDEFG0abcdefghijklmnop',
      'AKIAIOSFODNN7EXAMPLE',
      'xoxb-123456789012-abcdefghijklmnop',
      'npm_abcdefghijklmnopqrstuvwx',
      'glpat-abcdefghijklmnopqrst',
    ]) {
      const masked = maskSecrets(`installing with ${secret}`)
      expect(masked).toBe('installing with ****')
      expect(masked).not.toContain(secret.slice(4))
    }
  })

  it('masks JSON Web Tokens and long opaque tokens', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk'
    expect(maskSecrets(`token ${jwt}`)).toBe('token ****')
    const opaque = 'aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789+/aB'
    expect(maskSecrets(`digest ${opaque}`)).toBe('digest ****')
  })

  it('masks authorization schemes that bypass the named-field rule', () => {
    expect(maskSecrets('sent Bearer abc123def456')).toBe('sent Bearer ****')
    expect(maskSecrets('sent Basic dXNlcjpwYXNzd29yZA==')).toBe('sent Basic ****')
  })
})
