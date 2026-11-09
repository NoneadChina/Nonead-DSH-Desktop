/** AA-inspired first-run flow, using the existing Desktop theme and controls. */
import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowRight, Check, Keyboard, LifeBuoy, LoaderCircle, MousePointer2, Package, Scan } from 'lucide-react'
import { Button } from '../../../dsh-plugin-desktop-beta/src/native-ui/components/ui/button.tsx'
import { Switch } from '../../../dsh-plugin-desktop-beta/src/native-ui/components/ui/switch.tsx'
import { RadioGroup, RadioGroupItem } from '../../../dsh-plugin-desktop-beta/src/native-ui/components/ui/radio-group.tsx'
import { Alert, AlertDescription } from '../../../dsh-plugin-desktop-beta/src/native-ui/components/ui/alert.tsx'
import { DesktopFrame } from '../../../dsh-plugin-desktop-beta/src/native-ui/shared/DesktopFrame.tsx'
import type { DesktopBridge, DesktopState } from '../desktop-contract.ts'
import type { SetupNavigation } from '../../../dsh-plugin-desktop-beta/src/client/onboarding.tsx'
import { installPluginControlsStyles } from '../client/plugin-controls-styles.ts'
import { initialOnboardingComputerUse } from '../onboarding-defaults.ts'
import './onboarding.css'
import brandLogo from '../../build/app-icon.png'
import { desktopText } from '../desktop-i18n.ts'
// Reuse the portable device family artwork and composition from the AA landing page.
import phoneArtwork from './assets/agents-anywhere-phone.webp'
import tabletArtwork from './assets/agents-anywhere-tablet.webp'
type Market = 'none' | 'community' | 'dsh'
/** One bundled plugin as this wizard renders it; newer manifests also carry the optional fields. */
interface OnboardingPlugin {
  readonly name: string
  readonly version: string
  readonly description?: string
  readonly category?: string
  readonly author?: string
  readonly descriptionEn?: string
}
// Keep official dialog dependencies out of recovery and the earlier setup pages.
const DesktopPermissionsButton = lazy(() => import('../client/permissions.tsx').then(module => ({ default: module.DesktopPermissionsButton })))

export function Onboarding({ state, locale, bridge, renderNavigation, embedded = false }: { state: Pick<DesktopState, 'selected' | 'features' | 'onboardingComputerUse' | 'bundledPlugins' | 'bundledPluginIssue' | 'bundledPluginProgress'>; locale: 'zh' | 'en'; bridge: Pick<DesktopBridge, 'command' | 'permissions'>; renderNavigation: SetupNavigation; embedded?: boolean }) {
  const t = (zh: string, en: string) => desktopText(locale, zh, en)
  // The Host builds this wizard from a setup snapshot that carries only the Profile and its
  // feature flags, so the bundled plugin list never arrives through `state`. Read it from the
  // Desktop bridge, which serves the same state the settings windows use.
  const [bundled, setBundled] = useState<readonly OnboardingPlugin[]>(state.bundledPlugins ?? [])
  const [issue, setIssue] = useState<string | undefined>(state.bundledPluginIssue)
  // Progress of the bundled-plugin install that runs after pressing "Finish and start".
  const [installing, setInstalling] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number; current?: string } | undefined>(state.bundledPluginProgress)
  // The plugin being installed right now, described under the wizard's progress bar.
  const currentPlugin = progress?.current === undefined ? undefined : bundled.find(plugin => plugin.name === progress.current)
  const percent = progress === undefined ? 0 : Math.round((progress.done / Math.max(progress.total, 1)) * 100)
  useEffect(() => {
    if (bundled.length > 0) return
    const bridge = (globalThis as {
      desktopNext?: { state?: () => Promise<Pick<DesktopState, 'bundledPlugins' | 'bundledPluginIssue'> | undefined> }
    }).desktopNext
    if (bridge?.state === undefined) {
      setIssue('desktop bridge unavailable in this window')
      return
    }
    let cancelled = false
    void bridge.state().then(snapshot => {
      if (cancelled) return
      if (Array.isArray(snapshot?.bundledPlugins) && snapshot.bundledPlugins.length > 0) {
        setBundled(snapshot.bundledPlugins)
        setIssue(undefined)
      } else {
        setIssue(snapshot?.bundledPluginIssue ?? 'the desktop process reported no bundled plugins')
      }
    }).catch((error: unknown) => {
      // The wizard still completes without the list; it only loses the preview.
      if (!cancelled) setIssue(`desktop bridge failed: ${error instanceof Error ? error.message : String(error)}`)
    })
    return () => { cancelled = true }
  }, [])
  // While the install runs, poll the Desktop state: the wizard stays on screen until the
  // main window reloads, and each plugin takes a few seconds.
  useEffect(() => {
    if (!installing) return
    const bridge = (globalThis as {
      desktopNext?: { state?: () => Promise<Pick<DesktopState, 'bundledPluginProgress'> | undefined> }
    }).desktopNext
    if (bridge?.state === undefined) return undefined
    const poll = (): void => {
      void bridge.state!().then(snapshot => {
        if (snapshot?.bundledPluginProgress !== undefined) setProgress(snapshot.bundledPluginProgress)
      }).catch(() => { /* The wizard leaves as soon as the main window reloads. */ })
    }
    poll()
    const timer = setInterval(poll, 400)
    return () => { clearInterval(timer) }
  }, [installing])
  const [page, setPage] = useState(0)
  const [direction, setDirection] = useState(1)
  const [transitioning, setTransitioning] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  // Reopening the wizard must show the market this profile already uses; only a fresh
  // setup (no feature flags yet) falls back to dsh-market so it has a working market.
  // "none" has to come back as "none": the two booleans alone cannot tell a skipped
  // market apart from dsh-market, which is why the manifest stores marketChoice.
  const [market, setMarket] = useState<Market>(() =>
    state.features.marketChoice ?? (state.features.market ? 'community' : state.features.dshMarket ? 'dsh' : 'dsh'))
  const [remote, setRemote] = useState(state.features.remoteControl)
  // Reopening the wizard shows what this Profile stored; a Profile that never recorded
  // Computer Use falls back to the documented default instead of a hardcoded value.
  const [computerUse, setComputerUse] = useState(initialOnboardingComputerUse(state.onboardingComputerUse))
  const slide = useRef<HTMLDivElement>(null)
  const navigationLock = useRef(false)
  const saving = useRef(false)
  const mounted = useRef(true)
  const animation = useRef<Animation | undefined>(undefined)
  const disabled = busy || transitioning
  const steps = [t('欢迎', 'Welcome'), t('插件市场', 'Plugin market'), t('远程控制', 'Remote control'), 'Computer Use', t('恢复模式', 'Recovery'), t('内置插件', 'Bundled plugins')]
  const lastPage = steps.length - 1
  const titles = [t('欢迎使用\nNonead DSH Desktop', 'Welcome to\nNonead DSH Desktop'), t('用插件，\n拓展更多可能。', 'Make room\nfor more possibilities.'), t('离开电脑，\n也能继续。', 'Keep going.\nAway from your desk.'), t('让 AI 帮你\n操作电脑。', 'Let AI work\non your desktop.'), t('遇到问题，\n从这里恢复。', 'A way back,\nwhen you need it.'), t('这些插件，\n开箱即用。', 'Bundled in,\nready to go.')]
  const descriptions = [
    t(`为 Profile「${state.selected}」选好常用功能。\n几步设置，就可以开始。`, `Set up the essentials for Profile “${state.selected}”.\nA few choices, then you’re ready to go.`),
    t('选择一个插件市场，浏览和安装社区插件。\n也可以暂不开启，以后在插件页面调整。', 'Choose a market to browse and install community plugins.\nYou can also leave it off and decide later in Plugins.'),
    t('通过 Agents Anywhere，在手机、平板或其他电脑上，\n继续与你的 Agent 对话。', 'Use Agents Anywhere on your phone, tablet or another computer\nto keep the conversation going.'),
    t('查看屏幕内容，操作鼠标和键盘。\n理解截图需要支持图片输入的模型。', 'View the screen and control the mouse and keyboard.\nUnderstanding screenshots requires a model with image input.'),
    t('恢复助手可以在 Profile 无法启动时打开。\n先检查问题，再选择合适的恢复方式。', 'The recovery assistant works even when a Profile cannot start.\nCheck what happened, then choose how to recover.'),
    t(`本安装包自带 ${bundled.length} 个插件。点击“完成并开始”后会自动装好，\n完成前不需要任何操作。之后可以在插件市场的“已安装”里管理它们。`,
      `This installer carries ${bundled.length} plugins. Pressing “Finish and start” installs them\nautomatically, and you can manage them in the Market’s “Installed” tab afterwards.`),
  ]

  // The bundled-plugin step summarises the categories present in this installer instead of
  // listing every plugin; the install state below then details the one plugin going in.
  const pluginCategories = [
    { id: 'core', label: t('记忆与上下文', 'Memory & context'), detail: t('让对话记住来时的路，重要信息不必每次重讲。', 'Keeps earlier conversations in view, so context carries forward.') },
    { id: 'workspace', label: t('界面与工作区', 'Workspace & UI'), detail: t('面板、看板与市场工具，把工作区布置成你想要的样子。', 'Panels, boards and market tools that shape the workspace around you.') },
    { id: 'agent', label: t('智能体与技能', 'Agents & skills'), detail: t('更多可召唤的智能体、专家团与技能，随时听候调遣。', 'Extra agents, expert rosters and reusable skills, ready when needed.') },
    { id: 'docs', label: t('文档与媒体', 'Documents & media'), detail: t('直接读写 Office 文档、表格、图片与视频。', 'Read and write Office documents, spreadsheets, images and video.') },
    { id: 'engineering', label: t('代码与工程', 'Code & engineering'), detail: t('代码审查与仓库可视化，把工程现场看得更清楚。', 'Code review and repository visualisation, with the whole picture in view.') },
    { id: 'robot', label: t('机器人与仿真', 'Robotics & simulation'), detail: t('控制 Universal Robots 机械臂，也能离线仿真练手。', 'Drive Universal Robots arms, or rehearse offline in simulation.') },
    { id: 'integration', label: t('连接与自动化', 'Connections & automation'), detail: t('接上 MCP、配置与历史记录工具，把流程串起来。', 'MCP, configuration and prompt-history tools that tie your workflow together.') },
  ]
  const countLabel = (count: number): string => t(`${String(count)} 个插件`, `${String(count)} ${count === 1 ? 'plugin' : 'plugins'}`)
  const knownCategoryIds: ReadonlySet<string> = new Set(pluginCategories.map(category => category.id))
  // One row per category that this installer actually carries, ordered by the list above.
  // A plugin with a missing or unrecognised category is counted in the trailing bucket.
  const pluginOverview = ((): { key: string; label: string; detail: string; countText: string }[] => {
    const counts = new Map<string, number>()
    let others = 0
    for (const plugin of bundled) {
      if (plugin.category !== undefined && knownCategoryIds.has(plugin.category)) {
        counts.set(plugin.category, (counts.get(plugin.category) ?? 0) + 1)
      } else {
        others += 1
      }
    }
    const rows: { key: string; label: string; detail: string; countText: string }[] = []
    for (const category of pluginCategories) {
      const count = counts.get(category.id) ?? 0
      if (count === 0) continue
      rows.push({ key: category.id, label: category.label, detail: category.detail, countText: countLabel(count) })
    }
    if (others > 0) rows.push({ key: 'more', label: t('更多', 'More'), detail: t('其他随包插件，还没归入上面的分类。', 'Other bundled plugins that do not fit the categories above yet.'), countText: countLabel(others) })
    return rows
  })()
  const currentCategory = currentPlugin === undefined ? undefined : pluginCategories.find(category => category.id === currentPlugin.category)
  // English shows `descriptionEn` when the manifest carries it, and the shared description otherwise.
  const currentDescription = currentPlugin === undefined ? undefined : locale === 'en' ? currentPlugin.descriptionEn ?? currentPlugin.description : currentPlugin.description
  const currentAuthor = currentPlugin?.author

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; animation.current?.cancel() } }, [])
  useEffect(installPluginControlsStyles, [])
  useEffect(() => {
    if (page > 0 || direction < 0) slide.current?.querySelector('h1')?.focus({ preventScroll: true })
    slide.current?.closest('main')?.scrollTo({ top: 0 })
  }, [page, direction])

  async function navigate(next: number) {
    if (navigationLock.current || saving.current || next < 0 || next > lastPage) return
    navigationLock.current = true
    setTransitioning(true)
    try {
      const nextDirection = next > page ? 1 : -1
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches && slide.current) {
        const current = getComputedStyle(slide.current)
        animation.current = slide.current.animate([
          { opacity: current.opacity, transform: current.transform },
          { opacity: 0, transform: `translateX(${-nextDirection * 18}px)` },
        ], { duration: 180, easing: 'cubic-bezier(.4, 0, 1, 1)', fill: 'forwards' })
        await animation.current.finished.catch(() => {})
      }
      if (!mounted.current) return
      setDirection(nextDirection); setPage(next)
    } finally {
      // Release the lock on every path: an early return (or a cancelled animation) used to leave
      // the wizard permanently unable to navigate.
      if (mounted.current) setTransitioning(false)
      navigationLock.current = false
    }
  }

  async function finish(skip: boolean) {
    if (saving.current || navigationLock.current) return
    saving.current = true
    setBusy(true); setFailure('')
    // The install only runs for a completed wizard; show its progress instead of a spinner.
    if (!skip) setInstalling(true)
    try {
      await bridge.command(skip ? { type: 'onboarding-skip', profile: state.selected }
        : { type: 'onboarding-complete', profile: state.selected, computerUse, features: {
          market: market === 'community', dshMarket: market === 'dsh', marketChoice: market, remoteControl: remote,
        } })
    } catch (error) {
      if (!mounted.current) return
      setFailure(error instanceof Error ? error.message : String(error))
      // Leave the install view: keeping it would hide the primary action, so the only way to retry
      // a rejected save would be to skip setup.
      setInstalling(false); setBusy(false); saving.current = false
    }
  }

  const markets = [
    { value: 'community', title: 'dsh-community-market', detail: t('DSH Desktop 内置的开放插件市场，支持添加和选择自定义插件数据源。', 'DSH Desktop’s open plugin market, with support for custom plugin sources.') },
    { value: 'dsh', title: 'dsh-market', detail: t('社区热门的插件市场，数据来自 awesome-dsh-plugin。', 'A popular community market, powered by awesome-dsh-plugin.') },
    { value: 'none', title: t('暂不开启', 'Not now'), detail: t('以后可以在插件页面开启。', 'Enable a market later in Plugins.') },
  ]

  return <>{embedded ? null : <DesktopFrame />}<div className="next-onboarding dshNativeContent" lang={locale}>
    <header className="next-onboarding-progress">
      <ol aria-label={t('引导进度', 'Setup progress')}>{steps.map((step, index) => <li key={step} aria-current={index === page ? 'step' : undefined}><span className="sr-only">{step}</span></li>)}</ol>
      <span>{page + 1} / {steps.length}</span>
    </header>
    <main className="next-onboarding-main" aria-busy={busy}>
      <div key={page} ref={slide} className="next-onboarding-slide" data-page={page} style={{ '--entry-x': `${direction * 22}px` } as CSSProperties}>
        <section className="next-onboarding-copy" aria-labelledby="onboarding-title">
          {page > 0 && <p className="next-onboarding-eyebrow">{steps[page]}</p>}
          <h1 id="onboarding-title" tabIndex={-1}>{titles[page]!.split('\n').map((line, i) => <span className="next-onboarding-reveal" key={i} style={{ animationDelay: `${80 + i * 130}ms` }}>{line}</span>)}</h1>
          <p className="next-onboarding-description next-onboarding-reveal">{descriptions[page]}</p>
          {page === 2 && <div className="next-onboarding-option next-onboarding-reveal">
            <div className="next-onboarding-toggle"><label htmlFor="onboarding-remote">{t('启用远程控制', 'Enable remote control')}</label><Switch id="onboarding-remote" checked={remote} disabled={disabled} onCheckedChange={setRemote} /></div>
            <p>{t('完成后，在侧边栏的“远程控制”中登录并配对。', 'After setup, sign in and pair your device in “Remote Control” in the sidebar.')}</p>
          </div>}
          {page === 3 && <div className="next-onboarding-option next-onboarding-reveal">
            <div className="next-onboarding-toggle">
              <label htmlFor="onboarding-computer-use">{t('启用 Computer Use', 'Enable Computer Use')}</label>
              <div className="next-onboarding-option-actions">
                <Suspense fallback={<span className="next-onboarding-permissions-loading" aria-hidden="true"><LoaderCircle className="animate-spin" /></span>}>
                  <DesktopPermissionsButton service={bridge.permissions} language={locale} label={t('权限设置', 'Permission settings')} disabled={disabled} />
                </Suspense>
                <Switch id="onboarding-computer-use" checked={computerUse} disabled={disabled} onCheckedChange={setComputerUse} />
              </div>
            </div>
            <p>{t('通过“权限设置”管理系统权限，也可以稍后在插件页面调整。', 'Manage system permissions in “Permission settings”. You can also change these settings later in Plugins.')}</p>
          </div>}
        </section>
        <aside className="next-onboarding-panel next-onboarding-reveal" aria-label={steps[page]}>
          {page === 0 && <div className="next-onboarding-wordmark" aria-hidden="true">
            <img className="next-onboarding-whale" src={brandLogo} width="1024" height="1024" alt="" draggable={false} /><span>NONEAD.COM</span>
          </div>}
          {page === 1 && <RadioGroup aria-label={t('插件市场', 'Plugin market')} value={market} disabled={disabled} onValueChange={value => setMarket(value as Market)}>
            {markets.map(option => <label className="next-onboarding-choice" data-selected={market === option.value} key={option.value}>
              <span className="next-onboarding-choice-copy"><strong><span id={`market-${option.value}`}>{option.title}</span>{option.value === 'community' && <small>Beta</small>}</strong><span>{option.detail}</span></span>
              <RadioGroupItem value={option.value} aria-labelledby={`market-${option.value}`} />
            </label>)}
          </RadioGroup>}
          {page === 2 && <figure className="next-onboarding-devices" aria-hidden="true">
            <img className="next-onboarding-tablet" src={tabletArtwork} width="1500" height="1067" alt="" draggable={false} />
            <img className="next-onboarding-phone" src={phoneArtwork} width="720" height="1487" alt="" draggable={false} />
          </figure>}
          {page === 3 && <figure className="next-onboarding-computer" data-enabled={computerUse} aria-hidden="true">
            <div className="next-onboarding-screen">
              <div className="next-onboarding-screen-toolbar"><i /><i /><i /></div>
              <div className="next-onboarding-screen-content">
                <div className="next-onboarding-screen-sidebar"><i /><i /><i /></div>
                <div className="next-onboarding-screen-document"><i /><i /><i /><div className="next-onboarding-screen-selection" /></div>
              </div>
              <MousePointer2 className="next-onboarding-pointer" />
            </div>
            <figcaption><span><Scan />{t('查看', 'See')}</span><span><MousePointer2 />{t('点击', 'Click')}</span><span><Keyboard />{t('输入', 'Type')}</span></figcaption>
          </figure>}
          {page === 4 && <div className="next-onboarding-recovery">
            <h2 className="next-onboarding-recovery-title"><LifeBuoy aria-hidden="true" />{t('恢复助手', 'Recovery Assistant')}</h2>
            <ol>
              <li><strong>{t('打开恢复助手', 'Open the recovery assistant')}</strong><p>{t('托盘菜单 → 恢复助手。也可以在设置的“重启”菜单中选择进入恢复模式。', 'Choose Recovery Assistant in the tray menu, or restart into recovery from the Restart menu in Settings.')}</p></li>
              <li><strong>{t('选择恢复方式', 'Choose a recovery option')}</strong><p>{t('尝试临时安全模式、修复 Profile，或回滚到最近成功启动的配置。', 'Try temporary safe mode, repair the Profile, or restore its last successful-start configuration.')}</p></li>
              <li><strong>{t('回到工作中', 'Get back to work')}</strong><p>{t('完成后点击“启动或重试”。仍有问题时，可以导出诊断信息。', 'Choose “Start or retry” when ready. If the issue remains, export diagnostics for help.')}</p></li>
            </ol>
          </div>}
          {page === 5 && <div className="next-onboarding-recovery">
            <h2 className="next-onboarding-recovery-title"><Package aria-hidden="true" />{t('内置插件', 'Bundled plugins')}<small>{bundled.length}</small></h2>
            {bundled.length === 0
              ? <><p>{t('这个安装包没有附带插件。', 'This installer carries no plugins.')}</p>
                {issue === undefined ? null : <p><small>{issue}</small></p>}</>
              : <ul className="next-onboarding-categories" aria-label={t('随包插件分类', 'Bundled plugin categories')}>
                {pluginOverview.map(category => <li className="next-onboarding-category" key={category.key}>
                  <span className="next-onboarding-category-label">{category.label}</span>
                  <span className="next-onboarding-category-count">{category.countText}</span>
                  <p className="next-onboarding-category-detail">{category.detail}</p>
                </li>)}
              </ul>}
          </div>}
        </aside>
        {installing
          ? <div className="next-onboarding-actions next-onboarding-installing">
            <div className="next-onboarding-installing-copy" aria-live="polite">
              {currentPlugin === undefined
                ? <strong>{t('正在安装内置插件', 'Installing bundled plugins')}</strong>
                : <>
                  <strong className="next-onboarding-installing-name">{currentPlugin.name}</strong>
                  <div className="next-onboarding-installing-meta">
                    {currentCategory === undefined ? null : <span className="next-onboarding-installing-chip">{currentCategory.label}</span>}
                    <span className="next-onboarding-installing-version">v{currentPlugin.version}</span>
                  </div>
                  {currentDescription === undefined ? null : <p className="next-onboarding-installing-description">{currentDescription}</p>}
                  {currentAuthor === undefined ? null : <p className="next-onboarding-installing-thanks">{t('感谢 {author} 带来这个插件。', 'Thanks to {author} for this plugin.').replace('{author}', currentAuthor)}</p>}
                </>}
              <p className="next-onboarding-installing-hint">{t('装好后可在左侧「插件」页或设置的插件市场里找到它。', 'Once installed, find it under Plugins in the sidebar or the plugin market in Settings.')}</p>
            </div>
            <div className="next-onboarding-install-meter" role="progressbar" aria-label={t('内置插件安装进度', 'Bundled plugin install progress')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
              <span style={{ width: `${String(percent)}%` }} />
            </div>
            <p className="next-onboarding-installing-count">
              {progress === undefined ? t('准备中……', 'Preparing…') : `${String(progress.done)}/${String(progress.total)}`}
            </p>
          </div>
          : <div className="next-onboarding-actions">
            <Button className="next-onboarding-next" size="lg" disabled={disabled} onClick={() => void (page === lastPage ? finish(false) : navigate(page + 1))}>
              {busy ? <><LoaderCircle className="animate-spin" />{t('正在进入…', 'Opening…')}</> : page === lastPage ? <>{t('完成并开始', 'Finish and start')}<Check /></> : <>{t('下一步', 'Continue')}<ArrowRight /></>}
            </Button>
          </div>}
      </div>
      {failure && <Alert variant="destructive" className="next-onboarding-error"><AlertDescription>{failure}</AlertDescription></Alert>}
    </main>
    <nav className="next-onboarding-nav" aria-label={t('引导导航', 'Setup navigation')}>
      {renderNavigation({ busy: disabled, onBack: page > 0 ? () => void navigate(page - 1) : undefined, onSkip: () => void finish(true) })}
    </nav>
  </div></>
}
