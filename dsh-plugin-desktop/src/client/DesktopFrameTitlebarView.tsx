/** Independent Desktop frame portalled above the upstream content viewport. */

import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import type { DesktopSettingsApi } from './desktop-settings-api.ts'
import type { DesktopClientEnvironment } from './environment.ts'
import { Button } from '../native-ui/components/ui/button.tsx'
import type { DesktopSettingsLocaleKey } from './desktop-settings-locales.ts'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '../native-ui/components/ui/hover-card.tsx'

export interface DesktopFrameTitlebarInjected {
  readonly environment: DesktopClientEnvironment
  readonly api: Pick<
    DesktopSettingsApi,
    'openTerminal' | 'restart' | 'restartToRecovery' | 'reloadRenderer' | 'toggleDeveloperTools' | 'checkForUpdates'
  >
  readonly remoteControl?: { readonly seen: boolean; open(): Promise<void> }
}

export function DesktopVersionControl({
  version,
  checkForUpdates,
  t,
}: {
  readonly version: string
  readonly checkForUpdates: () => Promise<void>
  readonly t: (key: DesktopSettingsLocaleKey) => string
}) {
  const [checking, setChecking] = useState(false)
  const [failed, setFailed] = useState(false)
  const runCheck = (): void => {
    if (checking) return
    setChecking(true)
    setFailed(false)
    void checkForUpdates()
      .catch(() => { setFailed(true) })
      .finally(() => { setChecking(false) })
  }
  const visibleVersion = `v${version}`
  return (
    <HoverCard>
      <HoverCardTrigger
        closeDelay={200}
        delay={150}
        render={<button type="button" className="dshDesktopFrameVersion" />}
        aria-label={`${t('currentVersion')} ${visibleVersion}`}
      >
        {visibleVersion}
      </HoverCardTrigger>
      <HoverCardContent className="dshDesktopVersionPopover">
        <div className="dshDesktopVersionPopoverHeader">
          <span>{t('currentVersion')}</span>
          <strong>{visibleVersion}</strong>
        </div>
        <Button
          className="dshDesktopVersionCheckButton"
          disabled={checking}
          size="sm"
          variant="outline"
          onClick={runCheck}
        >
          <RefreshCw aria-hidden="true" />
          <span>{t(checking ? 'checkingForUpdates' : 'checkForUpdates')}</span>
        </Button>
        {failed && <span className="dshDesktopVersionCheckError" role="alert">{t('checkForUpdatesError')}</span>}
      </HoverCardContent>
    </HoverCard>
  )
}

/**
 * Horizontal frame surface; the unrelated upstream content starts below it.
 *
 * Desktop owns one presentation only, so this bar carries the product identity
 * and nothing else: no window-mode control and no launcher action group. Those
 * operations live in Settings and in the tray.
 */
export function DesktopFrameTitlebarView({ api, environment, t, remoteControl }: DesktopFrameTitlebarInjected & {
  readonly t: (key: DesktopSettingsLocaleKey) => string
}) {
  return (
    <header
      className="dshDesktopFrameTitlebar"
      data-dsh-desktop-frame="titlebar"
      data-platform={environment.platform}
      data-material={environment.material}
    >
      <div className="dshDesktopFrameIdentity">
        <span className="dshDesktopFrameProduct">Nonead DSH Desktop</span>
        <DesktopVersionControl version={environment.version} checkForUpdates={api.checkForUpdates} t={t} />
      </div>
      {remoteControl && (
        <div className="dshDesktopFrameActions">
          <button type="button" className="dshDesktopFrameMode dshDesktopRemoteControl" onClick={() => { void remoteControl.open().catch(() => {}) }}>
            {t('remoteControl')}{!remoteControl.seen && <span className="dshDesktopRemoteControlDot" aria-label={t('remoteControlNew')} />}
          </button>
        </div>
      )}
    </header>
  )
}
