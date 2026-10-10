/** Sequence existing Desktop setup content inside the official onboarding surface. */
import { useEffect, useState, type ReactNode } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings-account/client'
import { Button, Toast } from '@deepseek-ai/dsh-client-ui-primitives'
import type { DesktopOnboardingBridge, DesktopOnboardingSnapshot } from '../setup-onboarding-bridge.ts'

export type SetupNavigation = PropsRuntime<'onboarding.desktop.before'>['renderNavigation']
export type SetupContent = (snapshot: DesktopOnboardingSnapshot, locale: 'zh' | 'en', finish: DesktopOnboardingBridge['finish'], renderNavigation: SetupNavigation) => ReactNode

function pendingSnapshot(value: DesktopOnboardingSnapshot | null): DesktopOnboardingSnapshot | null {
  return value?.required || value?.accountPending || value?.restartPending ? value : null
}

export function registerDesktopOnboarding(ctx: Context, content: SetupContent): void {
  const bridge = (window as unknown as { dshDesktopSetup?: DesktopOnboardingBridge }).dshDesktopSetup
  if (!bridge) return
  ctx.slots.inject('onboarding.desktop.before', () => ctx.slots.register({
    name: 'onboarding.desktop.before', inject: () => ({ bridge, content, zh: ctx.locale.getLocale().active.startsWith('zh') }),
  }, DesktopOnboarding))
}

function DesktopOnboarding({ bridge, content, zh, renderSurface, renderLoading, renderNext, renderNavigation, accountStatus }: PropsRuntime<'onboarding.desktop.before'> & {
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
  useEffect(() => {
    if (!snapshot?.accountPending || snapshot.required || accountStatus !== 'credential-stored') return
    let disposed = false
    void bridge.dismissAccount(snapshot.profile).then(async () => {
      const next = snapshot.restartPending ? pendingSnapshot(await bridge.read()) : null
      if (!disposed) setSnapshot(next)
    }).catch(cause => { if (!disposed) setError(String(cause)) })
    return () => { disposed = true }
  }, [bridge, snapshot, accountStatus])
  if (error) return renderSurface(<div role="alert" style={{ padding: 48 }}>
    <p>{error}</p><Button onClick={() => { setError(''); setSnapshot(undefined); refresh(value => value + 1) }}>{zh ? '重试' : 'Retry'}</Button>
  </div>)
  if (snapshot === undefined) return renderLoading()
  if (snapshot === null) return renderNext()
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
    return <>{renderNext()}<Toast tone="success" holdMs={8000}
      text={zh ? '桌面设置已保存，下次重启后生效。' : 'Desktop settings saved. They will take effect after restarting.'}
      actions={[{ label: zh ? '立即重启' : 'Restart now', onClick: () => { void apply() } }]}
      onDone={() => { setSnapshot(null) }} /></>
  }
  if (!snapshot.required) {
    if (accountStatus === 'credential-stored') return renderLoading()
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
    return renderSurface(<section className="dshDesktopAccountSetup" aria-labelledby="desktop-account-title" aria-busy={busy}>
      <div>
        <h1 id="desktop-account-title">{zh ? '桌面设置已完成' : 'Desktop setup is complete'}</h1>
        <p>{zh ? '感谢你使用 Nonead DSH Desktop 桌面应用。' : 'Thank you for using Nonead DSH Desktop.'}</p>
        <p>{zh ? '你可以到「设置 - 插件市场」的「发现」页面中搜索 dsh-nonead-universal-robots，安装拓德科技的优傲机器人自然语言操作控制插件，实现优傲机器人的 AI 控制。' : 'Open Settings → Plugin Market → Discover and search for dsh-nonead-universal-robots to install the natural-language control plugin from Nonead Corporation for Universal Robots, enabling AI control of UR robots.'}</p>
        <div className="dshDesktopAccountActions">
          <Button variant="primary" disabled={busy} onClick={() => { void dismiss() }}>{zh ? '开始使用' : 'Get started'}</Button>
        </div>
      </div>
    </section>)
  }
  return renderSurface(<div className="dshDesktopSetupContent" data-platform={snapshot.input.platform}>{content(snapshot, zh ? 'zh' : 'en', async (profile, selection) => {
    await bridge.finish(profile, selection)
    // Stable/Beta keep this renderer alive; Next still applies through its Host restart.
    if (snapshot.edition === 'desktop') {
      try { setSnapshot(pendingSnapshot(await bridge.read())) }
      catch (cause) { setError(String(cause)) }
    }
    else setSnapshot(selection === undefined ? null : undefined)
  }, renderNavigation)}</div>)
}
