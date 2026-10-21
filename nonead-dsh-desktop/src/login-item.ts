/** OS login-item state, behind a small surface so the startup switch stays testable. */
export interface DesktopLoginItemApplication {
  setLoginItemSettings(settings: { openAtLogin: boolean }): void
  getLoginItemSettings(): { openAtLogin: boolean }
}

/**
 * Read the effective OS state. A platform or install that cannot answer reports disabled,
 * because the switch must never claim a startup entry that does not exist.
 */
export function readOpenAtLogin(application: DesktopLoginItemApplication): boolean {
  try { return application.getLoginItemSettings().openAtLogin === true } catch { return false }
}

/**
 * Apply the switch and report the state the operating system kept.
 * @param application - Electron application singleton (or a test double).
 * @param openAtLogin - desired startup state.
 * @returns the state read back after the write.
 */
export function writeOpenAtLogin(application: DesktopLoginItemApplication, openAtLogin: boolean): boolean {
  application.setLoginItemSettings({ openAtLogin })
  return readOpenAtLogin(application)
}
