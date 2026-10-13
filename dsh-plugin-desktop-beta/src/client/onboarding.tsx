/** Sequence existing Desktop setup content inside the official onboarding surface. */
import { useEffect, useState, type ReactNode } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type { SettingsOnboardingOwnerProps } from '@deepseek-ai/dsh-client-ui-settings/client'
import { Button, Modal, Toast } from '@deepseek-ai/dsh-client-ui-primitives'
import type { DesktopOnboardingBridge, DesktopOnboardingSnapshot } from '../setup-onboarding-bridge.ts'

/**
 * Onboarding navigation is drawn by the step itself.
 *
 * Upstream 0.2.1 hands the whole visible chrome of an onboarding step to its
 * registrant: the old `onboarding.desktop.before` seat supplied
 * `renderSurface`/`renderLoading`/`renderNext`/`renderNavigation`/`accountStatus`
 * as props, and none of them survived. The shape below is the one upstream's own
 * SetupWizard still calls, so desktop keeps driving its wizard unchanged.
 */
export type SetupNavigation = (options: { busy: boolean; onBack?: (() => void) | undefined; onSkip(): void }) => ReactNode
export type SetupContent = (snapshot: DesktopOnboardingSnapshot, locale: 'zh' | 'en', finish: DesktopOnboardingBridge['finish'], renderNavigation: SetupNavigation) => ReactNode

/**
 * Reuse the cell upstream reserves for the desktop app: it registers its own
 * `welcome-notice` step only when `dshDesktop` is absent from the global, and the
 * slot contract turns a reused id into a replacement of that exact cell.
 */
const DESKTOP_ONBOARDING_STEP_ID = 'welcome-notice'

/** An onboarding step advances only through its own controls, so implicit dismissals are ignored. */
function ignoreImplicitDismiss(): void {}

/**
 * Upstream's own onboarding steps wrap their visible content in a modal surface
 * and keep `#root` inert; that helper is not exported, so the same contract is
 * restated here rather than reaching into another package's internals.
 */
function OnboardingSurface({ title, children }: { title: string; children: ReactNode }): ReactNode {
  useEffect(() => {
    const appRoot = document.getElementById('root')
    if (appRoot === null) return
    const previous = appRoot.inert
    appRoot.inert = true
    return () => { appRoot.inert = previous }
  }, [])
  return <Modal open title={title} onClose={ignoreImplicitDismiss} headless className="dshDesktopOnboardingDialog">
    <div className="dshDesktopOnboardingBody">{children}</div>
  </Modal>
}

function pendingSnapshot(value: DesktopOnboardingSnapshot | null): DesktopOnboardingSnapshot | null {
  return value?.required || value?.accountPending || value?.restartPending ? value : null
}

export function registerDesktopOnboarding(ctx: Context, content: SetupContent): void {
  const bridge = (window as unknown as { dshDesktopSetup?: DesktopOnboardingBridge }).dshDesktopSetup
  if (!bridge) return
  ctx.slots.inject('settings.onboarding', () => ctx.slots.register({
    name: 'settings.onboarding',
    id: DESKTOP_ONBOARDING_STEP_ID,
    // Ahead of the shipped steps: the desktop wizard owns the first run.
    order: -100,
    inject: () => ({ bridge, content, zh: ctx.locale.getLocale().active.startsWith('zh') }),
  }, DesktopOnboarding))
}

function DesktopOnboarding({ complete, bridge, content, zh }: SettingsOnboardingOwnerProps & {
  bridge: DesktopOnboardingBridge; content: SetupContent; zh: boolean
}) {
  const [snapshot, setSnapshot] = useState<DesktopOnboardingSnapshot | null>()
  const [error, setError] = useState('')
  const [revision, refresh] = useState(0)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let disposed = false
    void bridge.read().then(value => {
      if (disposed) return
      setError('')
      setSnapshot(pendingSnapshot(value))
    }).catch(cause => { if (!disposed) setError(String(cause)) })
    return () => { disposed = true }
  }, [bridge, revision])
  // Nothing left for this step: hand ownership to the next entry rather than
  // painting an empty surface (the old `renderNext()` seat, now a callback).
  const settled = snapshot === null
  useEffect(() => {
    if (settled || busy) return
    if (snapshot === undefined || snapshot === null) return
    const idle = !snapshot.required && !snapshot.restartPending
    if (!idle || snapshot.accountPending) return
    complete()
  }, [complete, settled, busy, snapshot])
  if (error) return <OnboardingSurface title={zh ? '桌面引导' : 'Desktop setup'}>
    <div role="alert" className="dshDesktopOnboardingError">
      <p>{error}</p>
      <Button onClick={() => { setError(''); setSnapshot(undefined); refresh(value => value + 1) }}>{zh ? '重试' : 'Retry'}</Button>
    </div>
  </OnboardingSurface>
  // Private facts are still loading: a mounted-but-deciding step shows and blocks nothing.
  if (snapshot === undefined) return null
  if (snapshot === null) return null
  if (!snapshot.required && !snapshot.accountPending) {
    // Use the official transient portal; onboarding-only styles are inactive
    // once this continuation returns to the ordinary shell.
    const apply = async () => {
      if (busy || !bridge.applyPending) return
      setBusy(true)
      try { await bridge.applyPending(snapshot.profile); setSnapshot(null) }
      catch (cause) { setError(String(cause)) }
      finally { setBusy(false) }
    }
    return <Toast tone="success" holdMs={8000}
      text={zh ? '桌面设置已保存，下次重启后生效。' : 'Desktop settings saved. They will take effect after restarting.'}
      actions={[{ label: zh ? '立即重启' : 'Restart now', onClick: () => { void apply() } }]}
      onDone={() => { setSnapshot(null) }} />
  }
  if (!snapshot.required) {
    const dismiss = async () => {
      if (busy) return
      setBusy(true)
      try {
        await bridge.dismissAccount(snapshot.profile)
        const next = snapshot.restartPending ? pendingSnapshot(await bridge.read()) : null
        setSnapshot(next)
      } catch (cause) { setError(String(cause)) }
      finally { setBusy(false) }
    }
    return <OnboardingSurface title={zh ? '桌面设置已完成' : 'Desktop setup is complete'}>
      <section className="dshDesktopAccountSetup" aria-labelledby="desktop-account-title" aria-busy={busy}>
        <div>
          <h1 id="desktop-account-title">{zh ? '桌面设置已完成' : 'Desktop setup is complete'}</h1>
          <p>{zh ? '感谢你使用 Nonead DSH Desktop 桌面应用。' : 'Thank you for using Nonead DSH Desktop.'}</p>
          <p>{zh ? '你可以到「设置 - 插件市场」的「发现」页面中搜索 dsh-nonead-universal-robots，安装拓德科技的优傲机器人自然语言操作控制插件，实现优傲机器人的 AI 控制。' : 'Open Settings → Plugin Market → Discover and search for dsh-nonead-universal-robots to install the natural-language control plugin from Nonead Corporation for Universal Robots, enabling AI control of UR robots.'}</p>
          <div className="dshDesktopAccountActions">
            <Button variant="primary" disabled={busy} onClick={() => { void dismiss() }}>{zh ? '开始使用' : 'Get started'}</Button>
          </div>
        </div>
      </section>
    </OnboardingSurface>
  }
  const renderNavigation: SetupNavigation = ({ busy: navigating, onBack, onSkip }) => (
    <div className="dshSetupNavigation" aria-label={zh ? '引导导航' : 'Setup navigation'}>
      {onBack === undefined ? null : <Button disabled={navigating} onClick={onBack}>{zh ? '上一步' : 'Back'}</Button>}
      <Button disabled={navigating} onClick={onSkip}>{zh ? '跳过' : 'Skip'}</Button>
    </div>
  )
  return <OnboardingSurface title={zh ? '桌面引导' : 'Desktop setup'}>
    <div className="dshDesktopSetupContent" data-platform={snapshot.input.platform}>{content(snapshot, zh ? 'zh' : 'en', async (profile, selection) => {
      await bridge.finish(profile, selection)
      // Stable/Beta keep this renderer alive; Next still applies through its Host restart.
      if (snapshot.edition === 'desktop') {
        try { setSnapshot(pendingSnapshot(await bridge.read())) }
        catch (cause) { setError(String(cause)) }
      }
      else setSnapshot(selection === undefined ? null : undefined)
    }, renderNavigation)}</div>
  </OnboardingSurface>
}
