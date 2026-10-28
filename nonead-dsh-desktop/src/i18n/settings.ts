/**
 * Copy for the Desktop settings page.
 *
 * The shared settings sections author their labels as keys into the settings locale table, so
 * this module extends that table to every shell language and resolves a key with the same
 * normalization as `desktopText`. Chinese and English keep the shared copy verbatim.
 */
import { en as settingsEn, zh as settingsZh, type DesktopSettingsLocaleKey } from '../../../dsh-plugin-desktop-beta/src/client/desktop-settings-locales.ts'
import { normalizeDesktopLocale, type DesktopLocale } from '../desktop-i18n.ts'
import { settingsDe } from './settings-de.ts'
import { settingsEs } from './settings-es.ts'
import { settingsFr } from './settings-fr.ts'
import { settingsJa } from './settings-ja.ts'
import { settingsPt } from './settings-pt.ts'
import { settingsRu } from './settings-ru.ts'

/** Settings-page dictionaries by shell language; `zh` and `en` reuse the shared table. */
export const settingsDictionaries: Partial<Record<DesktopLocale, Readonly<Record<DesktopSettingsLocaleKey, string>>>> = {
  ja: settingsJa, es: settingsEs, fr: settingsFr, de: settingsDe, ru: settingsRu, pt: settingsPt,
}

/**
 * Resolve one settings-page label.
 * @param language - the active locale tag.
 * @param key - the shared settings locale key.
 * @returns the label for the active language, falling back to English and then the key.
 */
export function desktopSettingsText(language: string, key: string): string {
  const locale = normalizeDesktopLocale(language) ?? 'en'
  const dictionary = locale === 'zh' ? settingsZh : locale === 'en' ? settingsEn : settingsDictionaries[locale]
  return dictionary?.[key as DesktopSettingsLocaleKey] ?? settingsEn[key as DesktopSettingsLocaleKey] ?? key
}
