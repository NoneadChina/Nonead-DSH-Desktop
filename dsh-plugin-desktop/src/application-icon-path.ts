/** Platform-selected application icon shipped with the package. */

import { fileURLToPath } from 'node:url'

/**
 * Icon filename for one platform.
 *
 * Windows takes the multi-resolution `.ico`: the taskbar renders it at every DPI,
 * while the single-size PNG stays invisible there. macOS keeps its own inset export
 * and every other platform keeps the plain PNG.
 * @param platform - platform selecting the icon file.
 * @returns the shipped filename inside the package `build/` directory.
 */
export function desktopApplicationIconFilename(platform: NodeJS.Platform): string {
  if (platform === 'darwin') return 'app-icon-mac.png'
  if (platform === 'win32') return 'app-icon.ico'
  return 'app-icon.png'
}

/**
 * Absolute path of the shipped application icon.
 *
 * The path is derived from the module that calls it, so the Host plugin and the
 * Electron launcher resolve the same file from their own `lib/` entry points. Keep
 * this the only place that knows the platform-to-file mapping: the icon the Host
 * hands to the native shell and the icon the launcher publishes before any window
 * exists must never drift apart.
 * @param platform - platform selecting the icon file.
 * @param baseUrl - module URL whose package root holds `build/`; defaults to this module.
 * @returns absolute icon path.
 */
export function desktopApplicationIconPath(platform: NodeJS.Platform, baseUrl: string = import.meta.url): string {
  return fileURLToPath(new URL(`../build/${desktopApplicationIconFilename(platform)}`, baseUrl))
}
