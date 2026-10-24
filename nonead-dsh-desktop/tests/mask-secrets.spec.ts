import { describe, expect, it } from 'vitest'
import { maskSecrets } from '../src/mask-secrets.ts'

describe('maskSecrets', () => {
  it('masks API key values', () => {
    const masked = maskSecrets('key is sk-1234abcd5678')
    expect(masked).toContain('sk-****')
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

  it('masks the renderer credential header, its environment form and a bare token', () => {
    // 32 base64url bytes, exactly the renderer credential the shell hands the Host.
    const token = Buffer.alloc(32, 7).toString('base64url')
    expect(token).toHaveLength(43)

    const header = maskSecrets(`x-dsh-desktop-renderer: ${token}`)
    expect(header).toBe('x-dsh-desktop-renderer: ****')
    expect(header).not.toContain(token)

    const json = maskSecrets(JSON.stringify({ 'x-dsh-desktop-renderer': token }))
    expect(json).toBe('{"x-dsh-desktop-renderer":"****"}')
    expect(json).not.toContain(token)

    const assignment = maskSecrets(`spawn env DSH_NONEAD_NATIVE_TOKEN=${token} kept=yes`)
    expect(assignment).toBe('spawn env DSH_NONEAD_NATIVE_TOKEN=**** kept=yes')
    expect(assignment).not.toContain(token)

    const bare = maskSecrets(`forwarded a token ${token} on stdin`)
    expect(bare).toBe(`forwarded a token ${token.slice(0, 3)}**** on stdin`)
    expect(bare).not.toContain(token)
  })

  it('keeps long lowercase identifiers and prose readable', () => {
    const prose = 'the desktop-shell-context-menu-integration-compatibility-matrix is long'
    expect(maskSecrets(prose)).toBe(prose)
    expect(maskSecrets('path /app/node_modules/deepseek-harness-loaded-modules-here')).toContain('deepseek-harness-loaded-modules-here')
  })

  it('keeps UUID correlation ids readable for log triage', () => {
    const runId = 'a0b69169-e4a5-4b76-8705-05bb1e8e2f10'
    expect(maskSecrets(JSON.stringify({ runId }))).toBe(`{"runId":"${runId}"}`)
    expect(maskSecrets(`host.stop.failed runId=${runId}`)).toBe(`host.stop.failed runId=${runId}`)
  })
})
