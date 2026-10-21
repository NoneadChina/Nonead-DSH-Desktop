/** Presentation rules for the optional release notes carried by a version response. */

/**
 * Longest release-note summary a native tray label or notification body may carry.
 *
 * A tray label is one line: Windows clips an over-long menu item at a platform-chosen point and
 * macOS simply draws past the menu edge, so the truncation has to happen here where it can end on
 * a deliberate ellipsis.
 */
export const MAX_RELEASE_NOTE_SUMMARY_CHARACTERS = 120

/**
 * Reduce free-form release notes to the single line a native menu or notification can show.
 *
 * Notes are multi-paragraph text written for an in-app card, so only the first non-empty line is
 * kept: it is the headline, and reflowing the rest would only push it out of view. Without notes
 * this returns undefined so callers keep their historical copy byte for byte — an empty string
 * would add a dangling separator to the tray label and an empty paragraph to a notification.
 *
 * Length is counted in code points, not UTF-16 units, so clipping cannot leave half a surrogate
 * pair behind in the label.
 */
export function releaseNoteSummary(notes: string | undefined): string | undefined {
  if (notes === undefined) return undefined
  const headline = notes
    .split(/\r\n|\r|\n/u)
    .map(line => line.trim())
    .find(line => line.length > 0)
  if (headline === undefined) return undefined
  const collapsed = headline.replace(/\s+/gu, ' ')
  const characters = [...collapsed]
  return characters.length <= MAX_RELEASE_NOTE_SUMMARY_CHARACTERS
    ? collapsed
    : `${characters.slice(0, MAX_RELEASE_NOTE_SUMMARY_CHARACTERS).join('')}…`
}
