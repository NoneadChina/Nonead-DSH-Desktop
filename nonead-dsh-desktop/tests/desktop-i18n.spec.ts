import { readFileSync, globSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DESKTOP_LOCALES, desktopText, normalizeDesktopLocale, preferredDesktopLocale } from '../src/desktop-i18n.ts'
import { dictionaries } from '../src/i18n/index.ts'

/**
 * Every English half of an authored `(zh, en)` pair in the shell sources.
 *
 * Both call shapes are collected - the `t('zh', 'en')` helpers and the converted
 * `desktopText(locale, 'zh', 'en')` sites - and escapes are decoded so the key matches the
 * string the code produces at runtime.
 */
function authoredEnglishCopy(): Set<string> {
  const root = new URL('../src/', import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/u, '')
  const keys = new Set<string>()
  // `t('zh', 'en')` helpers and the `desktopText(locale, 'zh', 'en')` sites they resolve to.
  const shapes = [
    /\bt\('((?:[^'\\]|\\.)*)',\s*'((?:[^'\\]|\\.)*)'\)/gu,
    /\bdesktopText\([^,\n]*,\s*'((?:[^'\\]|\\.)*)'\s*,\s*'((?:[^'\\]|\\.)*)'\)/gu,
  ]
  const decode = (value: string): string => value.replaceAll("\\'", "'").replaceAll('\\"', '"').replaceAll('\\n', '\n')
  for (const relative of globSync('**/*.{ts,tsx}', { cwd: root })) {
    const text = readFileSync(`${root}/${relative}`, 'utf8')
    for (const shape of shapes) {
      for (const match of text.matchAll(shape)) {
        if (/[^\x00-\x7F]/u.test(match[1])) keys.add(decode(match[2]))
      }
    }
  }
  return keys
}

describe('desktop locale resolution', () => {
  it('serves the same eight languages as the official frontend', () => {
    expect([...DESKTOP_LOCALES]).toEqual(['zh', 'en', 'ja', 'es', 'fr', 'de', 'ru', 'pt'])
  })

  it('reduces region and script tags to a shell language', () => {
    expect(normalizeDesktopLocale('zh-CN')).toBe('zh')
    expect(normalizeDesktopLocale('zh_TW')).toBe('zh')
    expect(normalizeDesktopLocale('ja-JP')).toBe('ja')
    expect(normalizeDesktopLocale('pt-BR')).toBe('pt')
    expect(normalizeDesktopLocale('pt_PT')).toBe('pt')
    expect(normalizeDesktopLocale('de-AT')).toBe('de')
    expect(normalizeDesktopLocale('ko-KR')).toBeUndefined()
  })

  it('takes the first supported language from the preference list', () => {
    expect(preferredDesktopLocale(['ko-KR', 'ja-JP', 'en-US'])).toBe('ja')
    expect(preferredDesktopLocale(['ru'])).toBe('ru')
    expect(preferredDesktopLocale(['ko-KR'])).toBe('en')
  })
})

describe('desktop copy lookup', () => {
  it('returns the authored pair for Chinese and English', () => {
    expect(desktopText('zh-CN', '应用更新', 'App updates')).toBe('应用更新')
    expect(desktopText('en-GB', '应用更新', 'App updates')).toBe('App updates')
  })

  it('translates a registered language and keeps English for the rest', () => {
    expect(desktopText('ja-JP', '应用更新', 'App updates')).toBe('アプリのアップデート')
    expect(desktopText('fr', '应用更新', 'App updates')).toBe('App updates')
    expect(desktopText('ko-KR', '应用更新', 'App updates')).toBe('App updates')
  })
})

describe('dictionary coverage', () => {
  it('translates every authored pair for each registered language', () => {
    const authored = authoredEnglishCopy()
    expect(authored.size).toBeGreaterThan(150)
    for (const [language, dictionary] of Object.entries(dictionaries)) {
      const missing = [...authored].filter(key => dictionary?.[key] === undefined)
      expect(missing, `${language} is missing: ${missing.slice(0, 5).join(' | ')}`).toEqual([])
    }
  })

  it('holds no entry the sources no longer author', () => {
    const authored = authoredEnglishCopy()
    for (const [language, dictionary] of Object.entries(dictionaries)) {
      const orphans = Object.keys(dictionary ?? {}).filter(key => !authored.has(key))
      expect(orphans, `${language} has orphans: ${orphans.slice(0, 5).join(' | ')}`).toEqual([])
    }
  })
})
