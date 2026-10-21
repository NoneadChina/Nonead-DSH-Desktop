export const IPC = {
  shortcutsInput: 'nonead-dsh-desktop:shortcuts-input', shortcutsCloseWindow: 'nonead-dsh-desktop:shortcuts-close-window',
  shortcutsGet: 'nonead-dsh-desktop:shortcuts-get', shortcutsEdit: 'nonead-dsh-desktop:shortcuts-edit',
  shortcutsChanged: 'nonead-dsh-desktop:shortcuts-changed', shortcutsRecording: 'nonead-dsh-desktop:shortcuts-recording',
  boot: 'nonead-dsh-desktop:boot', failed: 'nonead-dsh-desktop:failed', directory: 'nonead-dsh-desktop:directory',
  state: 'nonead-dsh-desktop:state', command: 'nonead-dsh-desktop:command',
  settingsOpen: 'nonead-dsh-desktop:settings-open', settingsTake: 'nonead-dsh-desktop:settings-take',
  deepLink: 'nonead-dsh-desktop:deep-link',
  browserLinks: 'nonead-dsh-desktop:browser-links',
  browserAcquire: 'nonead-dsh-desktop:browser-acquire', browserRelease: 'nonead-dsh-desktop:browser-release',
  browserOpenRequested: 'nonead-dsh-desktop:browser-open-requested',
  permissionQuery: 'nonead-dsh-desktop:permission-query', permissionRequest: 'nonead-dsh-desktop:permission-request', permissionSettings: 'nonead-dsh-desktop:permission-settings',
  material: 'nonead-dsh-desktop:material',
  locale: 'nonead-dsh-desktop:locale', localeRead: 'nonead-dsh-desktop:locale-read',
  nativeThemeSet: 'nonead-dsh-desktop:native-theme-set', windowsAppearance: 'nonead-dsh-desktop:windows-appearance', windowsMenu: 'nonead-dsh-desktop:windows-menu',
} as const
export const APP_URL = 'dsh-app://app/'
export const SHELL_URL = 'dsh-app://shell/index.html'
