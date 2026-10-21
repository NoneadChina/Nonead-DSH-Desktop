/** The setup wizard's defaults, kept apart so both bundles can agree on them. */

/** A fresh setup starts with Computer Use on, so remote AI control works out of the box. */
export const DEFAULT_ONBOARDING_COMPUTER_USE = true

/**
 * The starting value of the Computer Use switch.
 *
 * Reopening the wizard must show what this Profile already stores, so a saved "off"
 * stays off; the default only applies to a Profile that never recorded the flag.
 * @param computerUse - the stored flag, or undefined when the Profile has none.
 */
export function initialOnboardingComputerUse(computerUse: boolean | undefined): boolean {
  return computerUse ?? DEFAULT_ONBOARDING_COMPUTER_USE
}
