/** Native installer handoff. No application files are replaced by our own code. */
import { execFile, spawn } from 'node:child_process'
import { lstat, mkdir, readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { autoUpdater } from 'electron'
import { serveMacUpdate } from './mac-update-feed.ts'

const execute = promisify(execFile)
export const NEXT_APP_ID = 'ai.deepseek.dsh.desktop'

/** Check both bundle identity and embedded SemVer, before Squirrel validates the signature. */
export function assertNextMacBundle(identifier: string, manifest: unknown, version: string): void {
  if (identifier.trim() !== NEXT_APP_ID || !manifest || typeof manifest !== 'object'
    || (manifest as { name?: unknown }).name !== 'nonead-dsh-desktop' || (manifest as { version?: unknown }).version !== version) {
    throw new Error('The downloaded application does not match this Next release')
  }
}

export function assertNextWindowsInstaller(info: { ProductName?: unknown; ProductVersion?: unknown }, version: string): void {
  if (info.ProductName !== 'Nonead DSH Desktop' || info.ProductVersion !== version) throw new Error('The installer does not match this Next release')
}

/** Publisher identity reported by Authenticode for one executable. */
export interface WindowsSignature {
  Status?: unknown
  Publisher?: unknown
}

/**
 * Windows counterpart of the macOS TeamIdentifier comparison.
 *
 * An unsigned local build has no publisher to compare against, and the assisted installer is the
 * only supported way to upgrade it, so it stays upgradeable. A signed installation only accepts an
 * installer signed by the same publisher; a missing, invalid, or foreign signature is rejected.
 */
export function assertNextWindowsSignature(candidate: WindowsSignature, installed: WindowsSignature): void {
  if (installed.Status !== 'Valid') return
  if (candidate.Status !== 'Valid' || typeof candidate.Publisher !== 'string'
    || candidate.Publisher.length === 0 || candidate.Publisher !== installed.Publisher) {
    throw new Error('The installer signing publisher does not match the installed application')
  }
}

/**
 * Arguments for the downloaded NSIS installer.
 *
 * `/S` silences the whole run, which looked like "nothing started" and gave the user no way to see
 * progress or a failure; the assisted installer is launched visibly instead. `--updated` keeps the
 * upgrade in place without re-asking for the install options.
 */
export function nextInstallerArguments(platform: string): readonly string[] {
  return platform === 'win32' ? ['--updated'] : []
}

export class NextUpdateInstaller {
  private prepared?: { path: string; version: string; archive?: string }
  private nativeReady = false
  /** Shared by the Install action and the shutdown handoff so the installer starts exactly once. */
  private launchTask?: Promise<void>
  // Keep EventEmitter errors handled even if a timed-out native operation finishes later.
  constructor(private readonly options: { platform: string; executable: string; log(error: unknown): void }) {
    if (options.platform === 'darwin') autoUpdater.on('error', options.log)
  }
  async prepare(path: string, version: string, directory: string, signal: AbortSignal): Promise<void> {
    this.prepared = undefined; this.nativeReady = false; this.launchTask = undefined
    if (this.options.platform === 'win32') {
      // Read the version resource and both Authenticode publishers in one shell so an update is
      // accepted only when the installer matches the installed application's signing identity.
      const script = [
        '$ErrorActionPreference="Stop"',
        '$candidate = Get-Item -LiteralPath $env:DSH_UPDATE_INSTALLER',
        '$installed = Get-Item -LiteralPath $env:DSH_UPDATE_APP',
        'function ReadSignature($file) {',
        '  $signature = Get-AuthenticodeSignature -LiteralPath $file.FullName',
        '  $publisher = if ($signature.SignerCertificate) { $signature.SignerCertificate.GetNameInfo("SimpleName", $false) } else { "" }',
        '  [pscustomobject]@{ Status = [string]$signature.Status; Publisher = $publisher }',
        '}',
        '[pscustomobject]@{',
        '  ProductName = $candidate.VersionInfo.ProductName',
        '  ProductVersion = $candidate.VersionInfo.ProductVersion',
        '  Candidate = ReadSignature $candidate',
        '  Installed = ReadSignature $installed',
        '} | ConvertTo-Json -Compress -Depth 4',
      ].join('\n')
      const info = await execute(join(process.env.SystemRoot ?? 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe'),
        ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
        {
          signal,
          timeout: 30_000,
          windowsHide: true,
          env: { ...process.env, DSH_UPDATE_INSTALLER: path, DSH_UPDATE_APP: this.options.executable },
          maxBuffer: 16_384,
        })
      const parsed = JSON.parse(info.stdout.replace(/^\uFEFF/, '')) as {
        ProductName?: unknown
        ProductVersion?: unknown
        Candidate?: WindowsSignature
        Installed?: WindowsSignature
      }
      assertNextWindowsInstaller(parsed, version)
      assertNextWindowsSignature(parsed.Candidate ?? {}, parsed.Installed ?? {})
      this.prepared = { path, version }; return
    }
    if (this.options.platform !== 'darwin') throw new Error('Unsupported update platform')
    const mount = join(directory, 'volume'); await mkdir(mount, { mode: 0o700 })
    const archive = join(directory, 'update.zip')
    const run = (file: string, args: string[]) => execute(file, args, { signal, timeout: 10 * 60_000, maxBuffer: 1024 * 1024 })
    // Updating an unsigned dev/ad-hoc build is not supported by Squirrel.Mac.
    const installed = dirname(dirname(dirname(this.options.executable)))
    await run('/usr/bin/codesign', ['--verify', '--deep', '--strict', installed])
    let attached = false
    try {
      await run('/usr/bin/hdiutil', ['attach', '-readonly', '-nobrowse', '-noautoopen', '-mountpoint', mount, path]); attached = true
      const entries = await readdir(mount, { withFileTypes: true })
      const apps = entries.filter(entry => entry.isDirectory() && entry.name.endsWith('.app'))
      if (apps.length !== 1) throw new Error('Expected one application in the Next disk image')
      const bundle = join(mount, apps[0]!.name)
      const info = await run('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleIdentifier', join(bundle, 'Contents', 'Info.plist')])
      // Releases through 2.0.17-next shipped the application unpacked, and every shipped updater reads the manifest
      // at that location. Archived releases keep a byte-for-byte copy of the archived manifest there as an extra
      // resource (`build.mac.extraResources`, checked by scripts/packaged-payload.ts) so that they all accept them.
      const manifestPath = join(bundle, 'Contents', 'Resources', 'app', 'package.json')
      const meta = await lstat(manifestPath)
      if (!meta.isFile() || meta.isSymbolicLink() || meta.size > 128 * 1024) throw new Error('Invalid Next application manifest')
      assertNextMacBundle(info.stdout, JSON.parse(await readFile(manifestPath, 'utf8')), version)
      await run('/usr/bin/codesign', ['--verify', '--deep', '--strict', bundle])
      const installedSignature = await run('/usr/bin/codesign', ['-dv', '--verbose=4', installed])
      const candidateSignature = await run('/usr/bin/codesign', ['-dv', '--verbose=4', bundle])
      const team = /^TeamIdentifier=([A-Z0-9]+)$/m.exec(installedSignature.stderr)?.[1]
      if (!team || !candidateSignature.stderr.split('\n').includes(`TeamIdentifier=${team}`)) throw new Error('Next update signing team does not match the installed application')
      await run('/usr/bin/ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', bundle, archive])
      this.prepared = { path, version, archive }
    } finally {
      // Do not use the aborted operation signal for unmounting a disk image.
      await execute('/usr/bin/hdiutil', ['detach', mount], { timeout: 30_000 }).catch(async () => {
        try { await execute('/usr/bin/hdiutil', ['detach', '-force', mount], { timeout: 30_000 }) }
        catch (error) { if (attached) throw error }
      })
    }
  }
  /** Only the explicit Install action arms Squirrel's apply-on-next-launch behavior. */
  async stage(): Promise<void> {
    const prepared = this.prepared
    if (!prepared) throw new Error('No prepared Next update')
    if (this.options.platform === 'win32') return
    if (this.nativeReady) return
    const feed = await serveMacUpdate(prepared.archive!, prepared.version)
    try {
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => { clearTimeout(timer); autoUpdater.off('error', fail); autoUpdater.off('update-downloaded', done); autoUpdater.off('update-not-available', unavailable) }
        const done = () => { cleanup(); this.nativeReady = true; resolve() }
        const fail = (error: Error) => { cleanup(); reject(error) }
        const unavailable = () => fail(new Error('Native updater did not accept the prepared release'))
        const timer = setTimeout(() => fail(new Error('Native updater timed out')), 10 * 60_000)
        autoUpdater.once('error', fail); autoUpdater.once('update-downloaded', done); autoUpdater.once('update-not-available', unavailable)
        try { autoUpdater.setFeedURL({ url: feed.url }); autoUpdater.checkForUpdates() } catch (error) { fail(error as Error) }
      })
    } finally { await feed.close() }
  }
  /**
   * Called after the Host and windows have finished shutting down, and again from the Install action
   * before it asks the app to quit. Launching early matters because the shutdown grace can expire
   * while the Host is still tearing down, and a timed-out quit exits without ever reaching the
   * post-shutdown handoff. The first call owns the single launch attempt: concurrent calls join it,
   * and a failed attempt stays retryable so pressing Install again can recover.
   */
  async launch(): Promise<void> {
    this.launchTask ??= this.startInstaller().catch((error: unknown) => {
      this.launchTask = undefined
      throw error
    })
    return this.launchTask
  }
  private async startInstaller(): Promise<void> {
    if (this.options.platform === 'darwin' && this.nativeReady) { autoUpdater.quitAndInstall(); return }
    const prepared = this.prepared
    if (this.options.platform !== 'win32' || !prepared) throw new Error('No prepared update installer')
    await new Promise<void>((resolve, reject) => {
      const child = spawn(prepared.path, [...nextInstallerArguments('win32')], { detached: true, stdio: 'ignore', shell: false, windowsHide: false })
      child.once('error', reject)
      child.once('spawn', () => { child.off('error', reject); child.on('error', this.options.log); child.unref(); resolve() })
    })
  }
}
