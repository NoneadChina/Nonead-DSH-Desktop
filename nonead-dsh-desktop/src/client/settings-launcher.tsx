/** Sidebar settings trigger that opens the Settings panel on the first click. */
import { IconSettingsOutlineMedium, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'

/** Sidebar geometry, shortcut labels and the settings navigation callback. */
export type DesktopSettingsLauncherProps = PropsRuntime<'settings.launcher'> & PropsLocale<'nonead-dsh-desktop'>

/**
 * Occupies `settings.launcher` so the sidebar seat opens Settings directly.
 *
 * Upstream's account launcher turns this seat into a menu whose first item is Settings; this
 * product keeps one click as one entry, so the shell's plain trigger presentation is restored with
 * the Desktop label. The seat is single-cardinality, so this registration shadows the account
 * launcher by declaring a lower priority; the account section stays registered separately.
 * @param props - sidebar geometry, shortcut labels and the settings navigation callback.
 * @returns the sidebar-foot settings trigger.
 */
export function DesktopSettingsLauncher({ wide, settingsShortcut, openSettings, t }: DesktopSettingsLauncherProps) {
  return (
    <Tooltip label={t('settingsTrigger')} shortcutKeys={settingsShortcut?.keys}>
      <button
        type="button"
        className="dshNextSettingsTrigger"
        data-collapsed={!wide}
        aria-label={t('settingsTrigger')}
        aria-haspopup="dialog"
        {...(settingsShortcut?.aria === undefined ? {} : { 'aria-keyshortcuts': settingsShortcut.aria })}
        onClick={openSettings}
      >
        <IconSettingsOutlineMedium size={16} />
        {wide && <span className="dshNextSettingsTriggerLabel">{t('settingsTrigger')}</span>}
      </button>
    </Tooltip>
  )
}
