import { expect, it } from 'vitest'
import { DEFAULT_ONBOARDING_COMPUTER_USE, initialOnboardingComputerUse } from '../src/onboarding-defaults.ts'

it('shows the stored Computer Use choice when the wizard reopens', () => {
  // A Profile that recorded "off" must not be flipped back on by a default.
  expect(initialOnboardingComputerUse(false)).toBe(false)
  expect(initialOnboardingComputerUse(true)).toBe(true)
})

it('falls back to the documented default only when the Profile never recorded one', () => {
  expect(DEFAULT_ONBOARDING_COMPUTER_USE).toBe(true)
  expect(initialOnboardingComputerUse(undefined)).toBe(true)
})
