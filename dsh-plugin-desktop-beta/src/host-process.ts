/** Electron owns the child lifetime; the child owns the unchanged DSH Web server. */
import { serializeHostEnvironment } from './host-launch-environment.ts'
import { utilityProcess } from 'electron'
import { fileURLToPath } from 'node:url'
import { HostRpc } from './host-rpc.ts'
import { bindNativeRuntime, runtimeSnapshot } from './host-runtime-bridge.ts'
import type { DesktopHostOptions } from './host-bootstrap.ts'
import type { DesktopRuntime } from './runtime.ts'
import type { DesktopStartupGenerationHost } from './startup-generation.ts'
import type { DesktopLanHttpsRuntimeOptions } from './lan-https-runtime.ts'

export interface IsolatedHostOptions {
  host: DesktopHostOptions
  runtime: DesktopRuntime
  rendererToken: string
  prepareCertificate: NonNullable<DesktopLanHttpsRuntimeOptions['prepareCertificate']>
  bindHost(host: DesktopStartupGenerationHost): void
  requestQuit(code: number): void
  onFailure(error: Error): void
  /**
   * Route one chunk of Host child output to a durable sink.
   *
   * The packaged GUI process has no console, so writing this to `process.stderr`
   * alone would silently discard the only channel that carries a bootstrap
   * failure (a missing module, an absent `parentPort`, or a V8 fatal error),
   * leaving the user with "DSH Host exited" and no cause anywhere.
   */
  onHostOutput?: (stream: 'stdout' | 'stderr', chunk: string) => void
}

/** Forward a child stream to the durable sink, falling back to the process stream. */
function forwardHostOutput(
  stream: 'stdout' | 'stderr',
  chunk: Buffer,
  onHostOutput: IsolatedHostOptions['onHostOutput'],
): void {
  const text = chunk.toString('utf8')
  if (onHostOutput === undefined) {
    if (stream === 'stdout') process.stdout.write(chunk)
    else process.stderr.write(chunk)
    return
  }
  try {
    onHostOutput(stream, text)
  } catch (cause) {
    // Never let a logging failure take down Host supervision.
    process.stderr.write(
      `dsh-plugin-desktop: failed to persist Host ${stream}: ${cause instanceof Error ? cause.message : String(cause)}\n`,
    )
  }
}

export async function startIsolatedDesktopHost(options: IsolatedHostOptions): Promise<void> {
  const child = utilityProcess.fork(fileURLToPath(new URL('./host-process-entry.js', import.meta.url)), [], {
    serviceName: 'DSH Host', stdio: 'pipe', cwd: process.cwd(), env: { ...process.env },
  })
  // Keep normal Host logs in its own files; the piped streams carry bootstrap
  // failures, so they must reach the parent's durable log sink.
  child.stdout?.on('data', (data: Buffer) => { forwardHostOutput('stdout', data, options.onHostOutput) })
  child.stderr?.on('data', (data: Buffer) => { forwardHostOutput('stderr', data, options.onHostOutput) })
  const rpc = new HostRpc({
    send: message => child.postMessage(message),
    listen: receive => { child.on('message', receive); return () => { child.removeListener('message', receive) } },
  }, 120_000)
  const releaseNative = bindNativeRuntime(rpc, options.runtime)
  // Host-contributed tray and menu commands stay in the Electron runtime until
  // this runs, so an unexpected exit that skipped it would leave live-looking
  // commands bound to a closed RPC channel. Release exactly once from either the
  // exit handler or an explicit stop, whichever happens first.
  let releaseNativeTask: Promise<void> | undefined
  const releaseNativeOnce = (): Promise<void> => releaseNativeTask ??= (async () => {
    try {
      await releaseNative()
    } catch (cause) {
      // A failed teardown must not become an unhandled rejection on the exit path.
      process.stderr.write(
        `dsh-plugin-desktop: failed to release Host native contributions: ${cause instanceof Error ? cause.message : String(cause)}\n`,
      )
    }
  })()
  rpc.handle('certificate', () => options.prepareCertificate())
  rpc.handle('quit', ([code]) => { setImmediate(() => options.requestQuit(code)) })
  let stopping = false
  let exited = false
  let booted = false
  let resolveExit!: () => void
  const exit = new Promise<void>(resolve => { resolveExit = resolve })
  child.once('exit', (code) => {
    exited = true
    rpc.close(`DSH Host exited (${code})`)
    void releaseNativeOnce()
    resolveExit()
    if (!stopping && booted) options.onFailure(new Error(`DSH Host exited (${code}); restart the application to reconnect`))
  })
  let stopTask: Promise<void> | undefined
  const stop = (): Promise<void> => stopTask ??= (async () => {
    stopping = true
    if (!exited) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 3_000)
      try { await rpc.call('stop', [], controller.signal) } catch { /* terminate an unresponsive Host */ }
      finally { clearTimeout(timeout) }
      if (!exited) child.kill()
      const timeoutExit = new Promise<boolean>(resolve => {
        const timer = setTimeout(() => {
          options.onHostOutput?.('stderr', 'dsh-plugin-desktop: DSH Host termination was not confirmed; continuing teardown\n')
          resolve(false)
        }, 1_000)
        void exit.then(() => { clearTimeout(timer); resolve(true) })
      })
      await timeoutExit
    }
    await releaseNativeOnce()
    rpc.close()
  })()
  options.bindHost({ fiber: { dispose: stop } })
  try {
    const { desktopLaunchEnvironment, ...host } = options.host
    await rpc.call('boot', [{ ...host, launchEnvironmentLayers: serializeHostEnvironment(desktopLaunchEnvironment) }, runtimeSnapshot(options.runtime), options.rendererToken])
    booted = true
  } catch (cause) {
    // Never let a teardown failure replace the real boot failure: the recovery
    // window and the log must report the defect, not a shutdown detail.
    try {
      await stop()
    } catch (stopCause) {
      options.onHostOutput?.(
        'stderr',
        `dsh-plugin-desktop: Host teardown after a boot failure also failed: ${stopCause instanceof Error ? stopCause.message : String(stopCause)}\n`,
      )
    }
    throw cause
  }
}
