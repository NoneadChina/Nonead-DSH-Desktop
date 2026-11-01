import { expect, it } from 'vitest'
import { preferredDesktopLocale } from '../src/menu-locale.ts'

it.each([
  [['zh-Hans-CN', 'en-US'], 'zh'], [['zh-Hant-TW'], 'zh'], [['zh_CN'], 'zh'],
  [['en-GB', 'zh-CN'], 'en'], [['ja-JP', 'zh-CN', 'en-US'], 'ja'], [['fr-FR'], 'fr'], [[], 'en'],
  [['pt-BR'], 'pt'], [['pt_PT'], 'pt'], [['ko-KR', 'de-DE'], 'de'], [['ru-RU', 'ja-JP'], 'ru'],
] as const)('chooses a supported language from %j in preference order', (languages, expected) => {
  expect(preferredDesktopLocale(languages)).toBe(expected)
})
