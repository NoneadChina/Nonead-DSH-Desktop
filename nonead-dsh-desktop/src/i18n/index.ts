/**
 * Translated copy for the shell's own screens.
 *
 * Every language here is keyed by the English half of the `(zh, en)` pairs the shell authors,
 * so adding one is a single import plus one line in `dictionaries`. A language that is not
 * listed yet simply falls back to English entry by entry.
 */
import { de } from './de.ts'
import { es } from './es.ts'
import { fr } from './fr.ts'
import { ja } from './ja.ts'
import { pt } from './pt.ts'
import { ru } from './ru.ts'
import type { DesktopDictionary, DesktopLocale } from '../desktop-i18n.ts'

/** Dictionaries by language; `zh` and `en` come straight from the authored pairs. */
export const dictionaries: Partial<Record<DesktopLocale, DesktopDictionary>> = { ja, es, fr, de, ru, pt }
