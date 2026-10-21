/** Main-process update ownership survives a stopped or broken Profile Host. */
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { checkForDesktopUpdate, type UpdateCheckResult, type UpdateRequest } from '../../dsh-plugin-desktop-beta/src/update-checker.ts'
import { desktopUpdateFilename, downloadDesktopUpdate, type UpdateArtifactRequest } from '../../dsh-plugin-desktop-beta/src/update-download.ts'
import { getOrCreateDesktopInstallationId } from '../../dsh-plugin-desktop-beta/src/desktop-installation-id.ts'
import { privateDirectory } from './private-files.ts'
import { clearSkippedVersion, readSkippedVersion, writeSkippedVersion } from './update-skip.ts'
import type { NextUpdateState } from './update-state.ts'

export interface NextUpdateOptions {
  version: string
  platform: string
  packaged: boolean
  userData: string
  /** Fetch adapter for the version check. */
  request: UpdateRequest
  /** Installer transport; it owns redirect following and its per-hop HTTPS check. */
  artifactRequest: UpdateArtifactRequest
  changed(): void
  log(error: unknown): void
  prepare(path: string, version: string, directory: string, signal: AbortSignal): Promise<void>
  install(): Promise<void>
}

export class NextUpdates {
  private state: NextUpdateState
  private result?: UpdateCheckResult
  private operation?: Promise<void>
  private controller?: AbortController
  private timer?: ReturnType<typeof setTimeout>
  private directory?: string
  private cacheReady?: Promise<void>
  /** Release the user dismissed; it stays hidden until a newer version is published. */
  private skipped?: string
  private disposed = false
  constructor(private readonly options: NextUpdateOptions) {
    this.state = { phase: 'idle', installable: options.packaged && ['darwin', 'win32'].includes(options.platform) }
  }
  snapshot(): NextUpdateState { return { ...this.state } }
  private initializeCache(): Promise<void> {
    return this.cacheReady ??= (async () => {
      const cache = join(this.options.userData, 'next-updates')
      privateDirectory(cache)
      // The skip decision is read once per process, before the first check can offer that release.
      this.skipped = readSkippedVersion(this.options.userData, this.options.log)
      // One primary process owns this userData tree. Clean our previous process's
      // completed installers/partial files; never delete arbitrary files in userData.
      for (const entry of await readdir(cache, { withFileTypes: true })) {
        if (entry.isDirectory() && /^download-[A-Za-z0-9]+$/.test(entry.name)) {
          await rm(join(cache, entry.name), { recursive: true, force: true }).catch(this.options.log)
        }
      }
    })()
  }
  private set(patch: Partial<NextUpdateState>): void {
    if (this.disposed) return
    // `retryInstall` describes one failed-install state; every later transition clears it.
    this.state = { ...this.state, error: undefined, retryInstall: undefined, ...patch }
    this.options.changed()
  }
  start(): void {
    if (!this.options.packaged || this.timer || this.disposed) return
    void this.initializeCache().catch(this.options.log)
    const poll = (): void => {
      if (this.disposed) return
      // A retryable install failure is waiting for the user; a background recheck would replace the
      // kept retry state with a fresh download offer. A skipped release keeps polling so a newer
      // version still surfaces without user action.
      if (['idle', 'current', 'error', 'skipped'].includes(this.state.phase) && !this.state.retryInstall) void this.check()
      this.timer = setTimeout(poll, 6 * 60 * 60_000); this.timer.unref()
    }
    this.timer = setTimeout(poll, 30_000); this.timer.unref()
  }
  private run(task: (signal: AbortSignal) => Promise<void>): Promise<void> {
    if (this.disposed) return Promise.resolve()
    if (this.operation) return this.operation
    this.controller = new AbortController()
    const signal = this.controller.signal
    this.operation = (async () => {
      try { await this.initializeCache(); signal.throwIfAborted(); await task(signal) }
      catch (error) { if (!signal.aborted) { this.options.log(error); this.set({ phase: 'error', error: 'download' }) } }
    })().finally(() => { this.operation = undefined; this.controller = undefined })
    return this.operation
  }
  private async query(signal: AbortSignal): Promise<UpdateCheckResult | null> {
    let installationId
    if (this.options.packaged) {
      try { installationId = await getOrCreateDesktopInstallationId(this.options.userData) } catch (error) { this.options.log(error) }
    }
    // The application follows the `stable` release channel: its artifact prefix
    // (`Nonead-DSH-Desktop-*`), the plain-SemVer version and the `:stable` root
    // scripts all name the same release stream.
    return checkForDesktopUpdate({ currentVersion: this.options.version, channel: 'stable', installationId,
      request: this.options.request, signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]) })
  }
  /** Record what one successful service answer means for this user, honoring a skipped release. */
  private offer(result: UpdateCheckResult): void {
    if (result.status !== 'update-available') { this.set({ phase: 'current', version: result.latestVersion }); return }
    // A newer release supersedes the skip, so the stale record is dropped instead of hiding it later.
    if (this.skipped && this.skipped !== result.latestVersion) {
      try { clearSkippedVersion(this.options.userData) } catch (error) { this.options.log(error) }
      this.skipped = undefined
    }
    this.set(this.skipped === result.latestVersion
      ? { phase: 'skipped', version: result.latestVersion }
      : { phase: 'available', version: result.latestVersion })
  }
  check(): Promise<void> {
    if (this.state.phase === 'ready' || this.state.phase === 'installing') return Promise.resolve()
    return this.run(async signal => {
      this.set({ phase: 'checking' })
      try {
        this.result = await this.query(signal) ?? undefined
        if (!this.result) { this.set({ phase: 'error', error: 'service', version: undefined }); return }
        this.offer(this.result)
      } catch (error) { this.options.log(error); this.set({ phase: 'error', error: 'service' }) }
    })
  }
  download(): Promise<void> {
    if (!this.state.installable) {
      this.set({ phase: 'error', error: this.options.packaged ? 'unsupported' : 'development' }); return Promise.resolve()
    }
    if (this.state.phase === 'ready' || this.state.phase === 'installing') return Promise.resolve()
    return this.run(async signal => {
      let preparing = false
      try {
        // Recheck before a counted download; the service also pins targetVersion across races.
        this.set({ phase: 'checking' })
        const result = await this.query(signal)
        if (!result) { this.set({ phase: 'error', error: 'service' }); return }
        this.result = result
        // A skipped release is never downloaded, even if an action was armed before the skip.
        if (result.status !== 'update-available' || this.skipped === result.latestVersion) { this.offer(result); return }
        const platform = this.options.platform as 'darwin' | 'win32'
        const cache = join(this.options.userData, 'next-updates'); privateDirectory(cache)
        if (this.directory) await rm(this.directory, { recursive: true, force: true })
        const directory = this.directory = await mkdtemp(join(cache, 'download-'))
        this.set({ phase: 'downloading', version: result.latestVersion, received: 0, total: undefined })
        let lastProgress = 0
        const path = await downloadDesktopUpdate({ platform, version: result.latestVersion, channel: 'stable',
          destinationPath: join(directory, desktopUpdateFilename(platform, result.latestVersion, 'stable')),
          request: this.options.artifactRequest, expectedSha256: result.installerSha256?.[platform],
          signal: AbortSignal.any([signal, AbortSignal.timeout(60 * 60_000)]), onProgress: (received, total) => {
            if (Date.now() - lastProgress < 250 && received !== total) return
            lastProgress = Date.now(); this.set({ received, total })
          } })
        signal.throwIfAborted()
        preparing = true; this.set({ phase: 'preparing' })
        await this.options.prepare(path, result.latestVersion, directory, signal)
        signal.throwIfAborted()
        this.set({ phase: 'ready' })
      } catch (error) {
        this.options.log(error)
        this.set({ phase: 'error', error: preparing ? 'prepare' : 'download' })
      }
    })
  }
  /** Dismiss the offered release until a newer one is published; the decision survives restarts. */
  skip(): void {
    if (this.disposed || this.state.phase !== 'available' || !this.state.version) return
    const version = this.state.version
    try { writeSkippedVersion(this.options.userData, version) } catch (error) { this.options.log(error); return }
    this.skipped = version
    this.set({ phase: 'skipped', version })
  }
  /** Undo a skip, so the still-current release is offered again right away. */
  async clearSkip(): Promise<void> {
    if (this.disposed) return
    try { clearSkippedVersion(this.options.userData) } catch (error) { this.options.log(error); return }
    this.skipped = undefined
    if (this.state.phase === 'skipped') await this.check()
  }
  async install(): Promise<void> {
    if (this.disposed || this.state.phase !== 'ready') return
    await this.startInstall()
  }
  /** Retry a failed install from the package it kept instead of downloading the update again. */
  async retryInstall(): Promise<void> {
    if (this.disposed || this.state.phase !== 'error' || this.state.error !== 'install' || !this.state.retryInstall) return
    await this.startInstall()
  }
  private async startInstall(): Promise<void> {
    this.set({ phase: 'installing' })
    try { await this.options.install() }
    catch (error) {
      this.options.log(error)
      // Keep the prepared directory: the retry action reuses this verified package, and `dispose`
      // preserves it until the next process start cleans the cache.
      this.set({ phase: 'error', error: 'install', retryInstall: true })
    }
  }
  async dispose(keepInstaller = false): Promise<void> {
    this.disposed = true
    clearTimeout(this.timer)
    this.controller?.abort()
    await this.operation
    // A retryable install failure keeps its package for the in-process retry action; a new process
    // removes the whole cache in `initializeCache`.
    if (this.directory && !keepInstaller && !this.state.retryInstall) await rm(this.directory, { recursive: true, force: true }).catch(this.options.log)
  }
}
