import { describe, expect, it } from 'vitest'
import { parseMarketPluginSpec } from '../src/plugin-spec.js'

describe('parseMarketPluginSpec', () => {
  it('accepts bare and scoped package names', () => {
    expect(parseMarketPluginSpec('dsh-plugin-demo')).toEqual({ ok: true, packageName: 'dsh-plugin-demo' })
    expect(parseMarketPluginSpec('  @nonead/dsh-plugin-demo  ')).toEqual({
      ok: true,
      packageName: '@nonead/dsh-plugin-demo',
    })
  })

  it('reports an empty entry', () => {
    expect(parseMarketPluginSpec('')).toEqual({ ok: false, reason: 'empty' })
    expect(parseMarketPluginSpec('   ')).toEqual({ ok: false, reason: 'empty' })
  })

  it('rejects a version pin instead of silently dropping it', () => {
    expect(parseMarketPluginSpec('dsh-plugin-demo@1.2.3')).toEqual({ ok: false, reason: 'version-pinned' })
    expect(parseMarketPluginSpec('@nonead/dsh-plugin-demo@next')).toEqual({ ok: false, reason: 'version-pinned' })
  })

  it('rejects every non registry identity', () => {
    for (const value of [
      'Dsh-Plugin-Demo',
      'dsh-plugin-demo/lib/index.js',
      'file:./local-plugin',
      'https://example.com/plugin.tgz',
      'git+ssh://git@github.com/nonead/plugin.git',
      'dsh plugin add demo',
    ]) {
      expect(parseMarketPluginSpec(value)).toEqual({ ok: false, reason: 'invalid-name' })
    }
  })

  it('bounds the length of the identity', () => {
    expect(parseMarketPluginSpec('a'.repeat(214))).toEqual({ ok: true, packageName: 'a'.repeat(214) })
    expect(parseMarketPluginSpec('a'.repeat(215))).toEqual({ ok: false, reason: 'too-long' })
  })

  it('rejects a non string input', () => {
    expect(parseMarketPluginSpec(undefined)).toEqual({ ok: false, reason: 'invalid-name' })
  })
})
