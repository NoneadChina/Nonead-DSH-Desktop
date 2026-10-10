/** Fixed Electron security policy for Desktop-owned local HTML windows. */

import { BrowserWindow, type BrowserWindowConstructorOptions } from 'electron'
import { desktopApplicationIcon } from './desktop-application-icon.ts'

export interface DesktopLocalWindowOptions extends Omit<BrowserWindowConstructorOptions, 'webPreferences'> {
  /** Dedicated in-memory session partition for this local workflow. */
  readonly partition: string
  /** Opt into Electron preferred-size events without exposing arbitrary WebPreferences. */
  readonly preferredSizeMode?: boolean
}

/** Construct a local-file window with no Node, preload, popup, or WebView path. */
export function createDesktopLocalWindow(options: DesktopLocalWindowOptions): BrowserWindow {
  const { partition, preferredSizeMode, ...windowOptions } = options
  if (!/^dsh-[a-z0-9-]+$/u.test(partition)) {
    throw new TypeError('dsh-plugin-desktop: local window partition must be a dedicated in-memory dsh-* partition')
  }
  // Windows resolves a taskbar button icon from the window icon, so a local window
  // created without one can show a blank button. Every Desktop-owned window reuses
  // the icon the shell validated, unless the caller supplied its own.
  const icon = windowOptions.icon ?? desktopApplicationIcon()
  const window = new BrowserWindow({
    ...windowOptions,
    ...(icon === undefined ? {} : { icon }),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInSubFrames: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
      spellcheck: false,
      ...(preferredSizeMode === undefined ? {} : { enablePreferredSizeMode: preferredSizeMode }),
      partition,
    },
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-attach-webview', event => { event.preventDefault() })
  return window
}
