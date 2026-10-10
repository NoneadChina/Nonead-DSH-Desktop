/** The validated application icon shared by every Desktop-owned window. */

import type { NativeImage } from 'electron'

let applicationIcon: NativeImage | undefined

/** Record the icon the shell validated, so later local windows reuse it exactly. */
export function setDesktopApplicationIcon(icon: NativeImage): void {
  applicationIcon = icon
}

/** The validated application icon, or `undefined` before the shell validated one. */
export function desktopApplicationIcon(): NativeImage | undefined {
  return applicationIcon
}
