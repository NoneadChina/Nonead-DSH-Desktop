/**
 * Direct settings trigger geometry, owned by Desktop.
 *
 * The seat replaces the upstream trigger with a Desktop button, so the button has to reproduce the
 * shell's own `.trigger` / `.trigger.rail` rules from `SettingsRoot.module.css` to stay
 * pixel-aligned with the rest of the sidebar foot: 42px row, 8px icon gap, 8/10px insets and the
 * sidebar's hover fill, collapsing to a 36px centered rail tile.
 *
 * The `body [data-slot=…]` prefix is load-order insurance, not decoration: plugin sheets are
 * appended at apply time, so source order cannot settle a tie, and this selector (0,2,1) beats any
 * single-class rule aimed at the seat.
 */

const STYLE_ID = 'dsh-next-settings-launcher-styles'

const CSS = `
body [data-slot="sidebar.settings"] .dshNextSettingsTrigger {
  display: flex;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  height: 42px;
  padding: 0 10px 0 8px;
  border: 0;
  border-radius: var(--dsw-radius-md);
  background: none;
  color: var(--dsw-alias-label-primary);
  font-family: inherit;
  font-size: 14px;
  line-height: 22px;
  text-align: start;
  cursor: pointer;
}
body [data-slot="sidebar.settings"] .dshNextSettingsTrigger:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}
body [data-slot="sidebar.settings"] .dshNextSettingsTrigger[data-collapsed="true"] {
  justify-content: center;
  height: 36px;
  gap: 0;
  padding: 0;
}
body [data-slot="sidebar.settings"] .dshNextSettingsTriggerLabel {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
`

/** Install the settings trigger sheet once; tolerate headless Client boot. */
export function installSettingsLauncherStyles(): () => void {
  if (typeof document === 'undefined') return () => {}
  if (document.getElementById(STYLE_ID) !== null) return () => {}
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.dataset.plugin = 'nonead-dsh-desktop'
  style.dataset.pluginCss = 'nonead-dsh-desktop/settings-launcher'
  style.textContent = CSS
  document.head.appendChild(style)
  return () => { style.remove() }
}
