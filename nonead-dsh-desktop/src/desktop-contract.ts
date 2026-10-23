/** General renderer state omits credentials; browser login links use a separate native operation. */
import type { Features, OnboardingChoices } from './profiles.ts'
import type { DesktopLanHttpsRuntimeSnapshot } from './lan-https-runtime.ts'
import type { DesktopPermissions } from './permissions.ts'
import type { DesktopDeepLink } from './deep-link.ts'

export const NATIVE_ACCESS_HEADER = 'x-dsh-desktop-renderer'
export const DEFAULT_PROFILE = 'desktop'
export type DesktopNotification =
  | { outcome: 'turn-completed'; userMessage: string; assistantMessage: string }
  | { outcome: 'turn-failed' }
  | { outcome: 'schedule-completed' | 'schedule-failed' }
export type NotificationOutcome = DesktopNotification['outcome']
export type DesktopSettingsPage = 'general' | 'permissions'

export interface DesktopPreferences {
  closeToTray: boolean
  macosMaterial: 'off' | 'transparent'
  /** Legacy key kept for the shared settings surface; Windows has no selectable material. */
  windowsMaterial: 'off'
  /** Accepted for the shared settings surface; Linux still renders an opaque frame. */
  linuxMaterial: 'off' | 'transparent'
  browserAccess: boolean
  networkExposure: 'loopback' | 'lan'
  port: number
  lanPort: number
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  developerLogging: boolean
  notifications: boolean
  turnCompleted: boolean
  turnFailed: boolean
  /** Retained for old preference files and the shared settings adapter; always disabled in Next. */
  jobCompleted: boolean
  jobFailed: boolean
  scheduleCompleted: boolean
  scheduleFailed: boolean
}

export const DEFAULT_PREFERENCES: Readonly<DesktopPreferences> = Object.freeze({
  closeToTray: true, macosMaterial: 'transparent', windowsMaterial: 'off', linuxMaterial: 'off',
  browserAccess: false, networkExposure: 'loopback', port: 0, lanPort: 0, logLevel: 'info', developerLogging: false,
  notifications: true, turnCompleted: true, turnFailed: true, jobCompleted: false, jobFailed: false,
  scheduleCompleted: true, scheduleFailed: true,
})

/** Fixed startup defaults matching Beta's disposable Safe Mode settings. */
export const SAFE_MODE_PREFERENCES: Readonly<DesktopPreferences> = Object.freeze({
  ...DEFAULT_PREFERENCES, macosMaterial: 'off', windowsMaterial: 'off', linuxMaterial: 'off',
  browserAccess: false, networkExposure: 'loopback', port: 0, lanPort: 0, logLevel: 'info', developerLogging: false,
  notifications: false, turnCompleted: false, turnFailed: false, jobCompleted: false, jobFailed: false,
  scheduleCompleted: false, scheduleFailed: false,
})

export interface DesktopState {
  selected: string
  profiles: string[]
  unavailableProfiles: string[]
  features: Features
  preferences: DesktopPreferences
  phase: 'starting' | 'ready' | 'error' | 'recovery'
  busy: boolean
  failure: string
  safeMode: boolean
  /** The selected Profile needs Desktop setup in the running official client. */
  onboarding?: boolean
  /** Initial saved choice for setup; live state belongs to pluginManager. */
  onboardingComputerUse?: boolean
  home: string
  platform: string
  version: string
  updates?: import('./update-state.ts').NextUpdateState
  /** OS login-item state: the application starts when the user signs in. */
  openAtLogin: boolean
  trayAvailable: boolean
  notificationsAvailable: boolean
  browserUrl: string | null
  lan: DesktopLanHttpsRuntimeSnapshot | null
  recovery?: {
    bundles: { bundleId: string; packageName: string; status: 'active' | 'disabled'; owner: 'core' | 'profile'; action: 'uninstall' | null; toggle: 'disable' | 'enable' | null }[]
    /** `kind`/`healthy` describe automatic snapshots: successful-start, before-rollback, before-plugin-disable, before-profile-repair. */
    checkpoints: { id: string; created: string; fileCount: number; totalBytes: number; kind?: string; healthy?: boolean }[]
    error?: string
    profileDirectory: string
    usingDefaultDirectory: boolean
    notice?: { tone: 'success'; title: string; body: string }
    diagnosticsFile?: string
  }
  checkpoint: { created: string } | null
  logs: string
}

/** Login links fetched explicitly by the native settings page, outside general state/diagnostics. */
export interface DesktopBrowserLinks {
  localUrl: string | null
  lanUrls: string[]
}

export type DesktopCommand =
  | { type: 'check-updates' | 'download-update' | 'install-update' | 'retry-install-update' | 'skip-update' | 'clear-skipped-update' }
  | { type: 'recovery-action'; action: string; id?: string }
  | ({ type: 'onboarding-complete'; profile: string } & OnboardingChoices)
  | { type: 'onboarding-skip'; profile: string }
  | { type: 'open-browser-url' | 'copy-browser-url'; url: string }
  | { type: 'create' | 'switch' | 'delete'; name: string }
  | { type: 'features'; features: Features }
  | { type: 'preferences'; preferences: DesktopPreferences }
  | { type: 'controls'; page?: 'general' | 'profiles' | 'create-profile' | 'tools' | 'recovery' | 'permissions' }
  | { type: 'restart-app' | 'restart-recovery' | 'restart-onboarding' | 'close-controls' }
  | { type: 'market-update-status' | 'upgrade-market' }
  | { type: 'set-open-at-login'; enabled: boolean }
  | { type: 'restart' | 'recover' | 'safe-mode' | 'normal-mode' | 'rollback' | 'repair-global'
    | 'reload' | 'devtools' | 'terminal' | 'open-home' | 'open-profile' | 'open-logs' | 'open-backups'
    | 'diagnostics' | 'open-browser' | 'open-lan' | 'copy-browser' | 'copy-lan' | 'export-ca' | 'quit' }

export interface DesktopBridge {
  readonly permissions?: DesktopPermissions
  /** Native menu/Host requests, delivered only to the main app. */
  onOpenSettings?(listener: (page: DesktopSettingsPage) => void): () => void
  /** `dsh-desktop://` links forwarded after the window was focused. */
  onDeepLink?(listener: (link: DesktopDeepLink) => void): () => void
  state(): Promise<DesktopState>
  browserLinks(): Promise<DesktopBrowserLinks>
  /** Commands may answer with data: the market status query returns the newest published version. */
  command(command: DesktopCommand): Promise<unknown>
}

declare global { interface Window { desktopNext?: DesktopBridge } }
