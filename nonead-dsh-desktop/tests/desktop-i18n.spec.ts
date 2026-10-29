import { readFileSync, globSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DESKTOP_LOCALES, desktopTemplate, desktopText, normalizeDesktopLocale, preferredDesktopLocale } from '../src/desktop-i18n.ts'
import { dictionaries } from '../src/i18n/index.ts'
import { en as settingsEn, zh as settingsZh } from '../../dsh-plugin-desktop-beta/src/client/desktop-settings-locales.ts'
import { desktopSettingsText, settingsDictionaries } from '../src/i18n/settings.ts'

/**
 * Every English half of an authored `(zh, en)` pair in the shell sources.
 *
 * All three call shapes are collected - the `t('zh', 'en')` helpers, the converted
 * `desktopText(locale, 'zh', 'en')` sites and the `t('zh', 'en', { ... })` placeholder
 * templates - and escapes are decoded so the key matches the string the code produces at runtime.
 */
function authoredEnglishCopy(): Set<string> {
  const root = new URL('../src/', import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/u, '')
  const keys = new Set<string>()
  const shapes = [
    /\bt\('((?:[^'\\]|\\.)*)',\s*'((?:[^'\\]|\\.)*)'\)/gu,
    /\bdesktopText\([^,\n]*,\s*'((?:[^'\\]|\\.)*)'\s*,\s*'((?:[^'\\]|\\.)*)'\)/gu,
    /\bt\('((?:[^'\\]|\\.)*)',\s*'((?:[^'\\]|\\.)*)'\s*,\s*\{/gu,
  ]
  const decode = (value: string): string => value.replaceAll("\\'", "'").replaceAll('\\"', '"').replaceAll('\\n', '\n')
  for (const relative of globSync('**/*.{ts,tsx}', { cwd: root })) {
    const text = readFileSync(`${root}/${relative}`, 'utf8')
    for (const shape of shapes) {
      for (const match of text.matchAll(shape)) {
        if (/[^\x00-\x7F]/u.test(match[1]!)) keys.add(decode(match[2]!))
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
    for (const language of ['es', 'fr', 'de', 'ru', 'pt']) {
      expect(desktopText(language, '应用更新', 'App updates'), language).not.toBe('App updates')
    }
    expect(desktopText('ko-KR', '应用更新', 'App updates')).toBe('App updates')
  })

  it('substitutes placeholder values after the template is translated', () => {
    const zh = '启用插件「{name}」？'
    const en = 'Enable “{name}”?'
    expect(desktopTemplate('ja', zh, en, { name: 'demo' })).toBe('プラグイン「demo」を有効にしますか？')
    expect(desktopTemplate('zh-CN', zh, en, { name: 'demo' })).toBe('启用插件「demo」？')
    expect(desktopTemplate('en-GB', zh, en, { name: 'demo' })).toBe('Enable “demo”?')
    // A missing value leaves the placeholder intact instead of printing "undefined".
    expect(desktopTemplate('de', zh, en, {})).toBe('Plugin „{name}“ aktivieren?')
    expect(desktopTemplate('ko-KR', zh, en, { name: 'demo' })).toBe('Enable “demo”?')
  })
})

describe('dictionary registration', () => {
  it('registers a dictionary for every language the shell serves besides Chinese and English', () => {
    expect(Object.keys(dictionaries).sort()).toEqual(['de', 'es', 'fr', 'ja', 'pt', 'ru'])
    for (const language of DESKTOP_LOCALES) {
      if (language === 'zh' || language === 'en') continue
      expect(dictionaries[language], `${language} dictionary`).toBeDefined()
    }
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

  it('keeps every placeholder of the English key in each translation', () => {
    for (const [language, dictionary] of Object.entries(dictionaries)) {
      for (const [key, value] of Object.entries(dictionary ?? {})) {
        const expected = [...key.matchAll(/\{(\w+)\}/gu)].map(match => match[1]).sort()
        const actual = [...value.matchAll(/\{(\w+)\}/gu)].map(match => match[1]).sort()
        expect(actual, `${language}: ${key}`).toEqual(expected)
      }
    }
  })
})

describe('settings-page copy', () => {
  it('translates every shared settings key for each registered language', () => {
    const keys = Object.keys(settingsZh)
    expect(keys.length).toBeGreaterThan(100)
    expect(Object.keys(settingsDictionaries).sort()).toEqual(['de', 'es', 'fr', 'ja', 'pt', 'ru'])
    for (const [language, dictionary] of Object.entries(settingsDictionaries)) {
      const missing = keys.filter(key => {
        const value = dictionary?.[key as keyof typeof settingsZh]
        return value === undefined || value.trim() === ''
      })
      expect(missing, `${language} settings is missing: ${missing.slice(0, 5).join(' | ')}`).toEqual([])
    }
  })

  it('resolves the shared table for Chinese and English and the extension for the rest', () => {
    expect(desktopSettingsText('zh-CN', 'title')).toBe(settingsZh.title)
    expect(desktopSettingsText('en-GB', 'title')).toBe(settingsEn.title)
    for (const language of ['ja', 'es', 'fr', 'de', 'ru', 'pt']) {
      expect(desktopSettingsText(language, 'title'), language).not.toBe(settingsEn.title)
    }
    expect(desktopSettingsText('ko-KR', 'title')).toBe(settingsEn.title)
    expect(desktopSettingsText('ja', 'not-a-key')).toBe('not-a-key')
  })
})
