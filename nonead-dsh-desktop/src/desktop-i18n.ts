/**
 * Desktop shell languages and copy lookup.
 *
 * The official frontend ships the same eight locales (its packages carry
 * `locale/{de,en,es,fr,ja,pt,ru,zh}.json`), so the shell's own screens - preferences,
 * recovery, permissions, onboarding, tray menus and dialog copy - are translated to that
 * same set here. English copy doubles as the dictionary key: every shell string is written
 * as a `(zh, en)` pair, so the English half identifies the entry without inventing keys.
 */

import { dictionaries } from './i18n/index.ts'

/** Languages the shell serves, matching the official frontend's locale set. */
export const DESKTOP_LOCALES = ['zh', 'en', 'ja', 'es', 'fr', 'de', 'ru', 'pt'] as const

/** One shell language. */
export type DesktopLocale = (typeof DESKTOP_LOCALES)[number]

/** Copy used when nothing matches. */
export const DEFAULT_DESKTOP_LOCALE: DesktopLocale = 'en'

/** English copy to translated copy. */
export type DesktopDictionary = Readonly<Record<string, string>>

const LOCALE_SET: ReadonlySet<string> = new Set(DESKTOP_LOCALES)

/**
 * Reduce a BCP 47 tag to a shell language.
 *
 * `pt-BR` and `pt-PT` both map to `pt` (Brazilian Portuguese is the shipped translation);
 * `zh-CN`, `zh-Hans` and bare `zh` map to `zh`; anything unknown is `undefined` so callers
 * can keep looking through the preference list.
 * @param tag - an OS or profile locale tag.
 * @returns the shell language, or `undefined` when the tag is not one of them.
 */
export function normalizeDesktopLocale(tag: string): DesktopLocale | undefined {
  const primary = tag.trim().toLowerCase().replaceAll('_', '-').split('-')[0] ?? ''
  return LOCALE_SET.has(primary) ? primary as DesktopLocale : undefined
}

/**
 * Follow the preference order and take the first supported language.
 * @param languages - BCP 47 tags in preference order.
 * @returns the chosen shell language, `en` when none match.
 */
export function preferredDesktopLocale(languages: readonly string[]): DesktopLocale {
  for (const language of languages) {
    const locale = normalizeDesktopLocale(language)
    if (locale !== undefined) return locale
  }
  return DEFAULT_DESKTOP_LOCALE
}

/**
 * Resolve one shell string.
 *
 * `zh` and `en` come straight from the authored pair. Every other language looks the English
 * half up in its dictionary and falls back to English for a missing entry, so a partially
 * translated language never shows an empty label.
 * @param language - the active locale tag.
 * @param zh - Simplified Chinese copy.
 * @param en - English copy, also the dictionary key.
 * @returns the copy for the active language.
 */
export function desktopText(language: string, zh: string, en: string): string {
  const locale = normalizeDesktopLocale(language) ?? DEFAULT_DESKTOP_LOCALE
  if (locale === 'zh') return zh
  if (locale === 'en') return en
  return dictionaries[locale]?.[en] ?? en
}
