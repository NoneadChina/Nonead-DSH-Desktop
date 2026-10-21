import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { DesktopCommand, DesktopState } from '../desktop-contract.ts'
import { updateAction, updateLabel } from '../update-state.ts'

export function NextUpdateSettings({ state, language, run }: { state: DesktopState; language: string; run(command: DesktopCommand): void }) {
  const update = state.updates
  if (!update) return null
  const t = (zh: string, en: string) => language.startsWith('zh') ? zh : en
  const action = updateAction(update)
  // Recheck and skip only make sense while a release waits for the user; a running update
  // operation owns the state machine until it settles.
  const busy = state.busy || ['checking', 'downloading', 'preparing', 'installing'].includes(update.phase)
  const notes = update.notes
  const notesUrl = update.notesUrl
  return <section className="dshDesktopSettingsGroup" data-next-updates>
    <h3>{t('应用更新', 'App updates')}</h3>
    <p className="dshDesktopSettingsHint">Nonead DSH Desktop · {state.version}</p>
    <p role={update.phase === 'error' ? 'alert' : 'status'}>{updateLabel(update, language)}</p>
    {(notes !== undefined || notesUrl !== undefined) && <div data-release-notes>
      <p className="dshDesktopSettingsHint">{t('更新说明', 'Release notes')}</p>
      {notes !== undefined && <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{notes}</p>}
      {/* Only an absolute https URL survives parsing; the OS browser owns the page, so the shell
          opener never gains a navigation-capable window handle. */}
      {notesUrl !== undefined && <div className="dshDesktopSettingsDialogActions">
        <Button variant="outline" size="sm" onClick={() => { window.open(notesUrl, '_blank', 'noopener,noreferrer') }}>{t('查看完整说明', 'View full release notes')}</Button>
      </div>}
    </div>}
    {update.phase === 'ready' && <p className="dshDesktopSettingsHint">{t('安装时会重启应用并中断正在运行的任务，Profile 和会话会保留。', 'Installation restarts the app and interrupts running tasks. Profiles and sessions are retained.')}</p>}
    {update.phase === 'error' && update.retryInstall && <p className="dshDesktopSettingsHint">{t('已下载的安装包仍保留，重试无需重新下载。', 'The downloaded installer is still on disk, so retrying does not download it again.')}</p>}
    {update.phase === 'skipped' && <p className="dshDesktopSettingsHint">{t('该版本不会再次提示；发布更新的版本后会照常提示，也可以在这里恢复。', 'This version is no longer offered. A newer release is offered as usual, and you can undo the skip here.')}</p>}
    {update.phase === 'downloading' && <progress style={{ width: '100%' }} aria-label={t('更新下载进度', 'Update download progress')} max={update.total ?? 1} value={update.total ? update.received ?? 0 : undefined} />}
    {!update.installable && <p className="dshDesktopSettingsHint">{t('应用内安装更新需要使用 macOS 或 Windows 安装版。', 'Install a packaged macOS or Windows build to use in-app updates.')}</p>}
    <div className="dshDesktopSettingsDialogActions">
      <Button variant="outline" size="sm" disabled={state.busy || !action || action !== 'check-updates' && !update.installable} onClick={() => { if (action) run({ type: action }) }}>
        {action === 'install-update' ? t('安装并重启', 'Install and restart') : action === 'retry-install-update' ? t('重试安装', 'Retry install') : action === 'download-update' ? t('下载更新', 'Download update') : t('检查更新', 'Check for updates')}
      </Button>
      {update.phase === 'available' && <Button variant="outline" size="sm" disabled={busy} onClick={() => run({ type: 'check-updates' })}>{t('重新检查', 'Check again')}</Button>}
      {update.phase === 'available' && update.version !== undefined && <Button variant="outline" size="sm" disabled={busy} onClick={() => run({ type: 'skip-update' })}>{t('跳过此版本', 'Skip this version')}</Button>}
      {update.phase === 'skipped' && <Button variant="outline" size="sm" disabled={busy} onClick={() => run({ type: 'clear-skipped-update' })}>{t('不再跳过', 'Stop skipping')}</Button>}
    </div>
  </section>
}
