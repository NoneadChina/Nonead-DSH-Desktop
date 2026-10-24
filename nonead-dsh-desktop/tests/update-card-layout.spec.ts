import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { updateLabel } from '../src/update-state.ts'

/**
 * The settings card is a pure renderer over `DesktopState`, so its ordering is asserted against
 * the source the same way other structural UI guards in this repository are: a jsdom harness would
 * pull in the whole client primitive tree for two element positions.
 */
const source = readFileSync(new URL('../src/client/updates.tsx', import.meta.url), 'utf8')

describe('desktop settings update card', () => {
  it('names the product rather than the retired Next channel when the service fails', () => {
    expect(updateLabel({ phase: 'error', error: 'service', installable: true }, 'zh-CN'))
      .toBe('暂时无法获取 Nonead-DSH-Desktop 更新，请稍后重试。')
    expect(updateLabel({ phase: 'error', error: 'service', installable: true }, 'en'))
      .toBe('Nonead-DSH-Desktop updates are temporarily unavailable. Try again later.')
    expect(source).not.toContain('Next 更新')
  })

  it('keeps the download bar under its progress label and above the release notes', () => {
    const label = source.indexOf('updateLabel(update, language)')
    const progress = source.indexOf('<progress')
    const notes = source.indexOf('data-release-notes')
    expect(label).toBeGreaterThan(-1)
    expect(progress).toBeGreaterThan(label)
    expect(notes).toBeGreaterThan(progress)
    // One bar only: a second copy further down would be the old position this test replaced.
    expect(source.indexOf('<progress', progress + 1)).toBe(-1)
  })
})
