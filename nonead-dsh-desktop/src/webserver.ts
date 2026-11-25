/** Keep upstream HTTP routing while requiring Host credentials for browser-reachable routes. */
import { hostLog, hostOperation } from './host/logging.ts'
import WebServer, { type WebResource, type WebResourceRoute, type WebRoute, type WebUpgradeRoute } from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-client-connection'
import { decideDesktopBrowserAccess, nextBrowserAccess } from './desktop-browser-access.ts'
import type { Duplex } from 'node:stream'

/**
 * The Desktop shell always hands the Host a renderer credential. When it is missing the Host
 * cannot tell the Electron renderer from an ordinary browser, so requests fail closed rather
 * than falling open; one log line explains the refusal for the whole process.
 */
let unavailablePolicyReported = false

export default class NextWebServer extends WebServer {
  static override Config = WebServer.Config
  private readonly browserSockets = new Set<Duplex>()

  /** Revoke existing browser streams as well as new requests; native streams stay alive. */
  setBrowserAccess(enabled: boolean): void {
    const access = nextBrowserAccess()
    if (!access) throw new Error('Native browser-access policy is unavailable')
    access.setOrdinaryBrowserEnabled(enabled)
    if (!enabled) {
      for (const socket of this.browserSockets) socket.destroy()
      this.browserSockets.clear()
    }
  }

  /**
   * Refuse browser-class traffic when the renderer credential is unavailable.
   *
   * A missing policy used to permit every request, so a Host booted without the credential
   * served browser traffic as if browser access were enabled. Requests carrying the exact
   * renderer header still pass whenever a policy exists (the Electron renderer does); with no
   * policy at all there is no way to recognise them, so refusing is the only safe answer.
   */
  private permits(request: Parameters<WebRoute['handler']>[0]): boolean {
    const access = nextBrowserAccess()
    if (access !== undefined) return decideDesktopBrowserAccess(access, request) !== 'denied'
    return this.rejectWithoutPolicy()
  }

  /** Fail closed on a Host that booted without the renderer credential. */
  private rejectWithoutPolicy(): false {
    if (!unavailablePolicyReported) {
      unavailablePolicyReported = true
      hostLog({ source: 'host.http', event: 'browser-access.unavailable', level: 'warn',
        message: 'The renderer credential is unavailable, so browser requests are refused' })
    }
    return false
  }

  /** A resource answers with a `Response`; the gate has to answer one too. */
  private gateResource(resource: WebResource): WebResource {
    return async (request, peer) => {
      if (!this.permitsResource(request)) return new Response('Browser access is disabled', { status: 403, headers: { 'cache-control': 'no-store' } })
      return await resource(request, peer)
    }
  }

  override register(route: WebRoute | WebResourceRoute): () => void {
    if ('resource' in route) {
      // `dsh 0.2.2-rc.1` serves static assets as Fetch resources, so the renderer capability
      // arrives as a header and the gate answers with a `Response`. The route keeps upstream's
      // own authentication policy: the kernel admits the session before this resource runs.
      return super.register({ ...route, resource: this.observeResource(String(route.path), this.gateResource(route.resource)) })
    }
    return super.register({ ...route, handler: this.observeHttp(route.path, async (request, response, peer) => {
      if (!this.permits(request)) { response.writeHead(403, { 'cache-control': 'no-store' }); response.end('Browser access is disabled'); return }
      // The admitted Peer must survive this wrapper: `/api` answers nothing without it.
      await route.handler(request, response, peer)
    }) })
  }

  /**
   * The renderer credential travels as a header on a Fetch request too, so the gate reads the
   * flattened header map rather than an `IncomingMessage`.
   */
  private permitsResource(request: Request): boolean {
    const access = nextBrowserAccess()
    if (access === undefined) return this.rejectWithoutPolicy()
    const headers: Record<string, string> = {}
    request.headers.forEach((value, name) => { headers[name.toLowerCase()] = value })
    return decideDesktopBrowserAccess(access, { headers, url: request.url }) !== 'denied'
  }

  /** A resource answers with a `Response`, so the trace settles on the returned status. */
  private observeResource(route: string, resource: WebResource): WebResource {
    return async (request, peer) => {
      const end = hostOperation('host.http', 'resource', { route, method: request.method }, true)
      try {
        const response = await resource(request, peer)
        end(undefined, { status: response.status })
        return response
      } catch (error) {
        end(error)
        throw error
      }
    }
  }

  private observeHttp(route: string, handler: WebRoute['handler']): WebRoute['handler'] {
    return async (request, response, peer) => {
      const end = hostOperation('host.http', 'request', { route, method: request.method ?? '' }, true)
      const finish = () => { end(undefined, { status: response.statusCode, aborted: !response.writableFinished }); response.off('finish', finish); response.off('close', finish) }
      response.once('finish', finish); response.once('close', finish)
      try { await handler(request, response, peer) } catch (error) { response.off('finish', finish); response.off('close', finish); end(error); throw error }
    }
  }

  /**
   * Apply the browser gate to the fallback without taking over its seat.
   *
   * `dsh 0.2.3-alpha.1` registers the frontend fallback as a resource whose `auth` policy makes
   * the index page `required` and its assets `anonymous`, and whose resource renders the index
   * for the peer upstream resolved. Replacing that policy, or resolving the peer here, answered
   * every page request with 404 — so the fallback is forwarded unchanged apart from the gate.
   */
  override registerFallback(fallback: WebRoute['handler'] | Pick<WebRoute, 'handler' | 'auth'> | Pick<WebResourceRoute, 'resource'>): () => void {
    if (typeof fallback === 'function' || 'handler' in fallback) {
      const handler = typeof fallback === 'function' ? fallback : fallback.handler
      const gated = this.observeHttp('fallback', async (request, response, peer) => {
        if (!this.permits(request)) { response.writeHead(403, { 'cache-control': 'no-store' }); response.end('Browser access is disabled'); return }
        await handler(request, response, peer)
      })
      // Keep the caller's own policy when it declared one; `undefined` means the kernel default.
      return super.registerFallback(typeof fallback === 'function' ? gated : { ...fallback, handler: gated })
    }
    return super.registerFallback({ ...fallback, resource: this.observeResource('fallback', this.gateResource(fallback.resource)) })
  }

  override registerUpgrade(route: WebUpgradeRoute): () => void {
    return super.registerUpgrade({ ...route, handler: (request, socket, head, peer) => {
      hostLog({ source: 'host.http', event: 'upgrade', fields: { route: route.path }, developer: true })
      if (!this.permits(request)) { socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'); return }
      // Browser-class upgrades are tracked so revoking browser access also drops live streams;
      // the kernel's connection authentication already answered 401/403 for anonymous callers.
      const access = nextBrowserAccess()
      if (access && decideDesktopBrowserAccess(access, request) === 'browser') {
        this.browserSockets.add(socket)
        socket.once('close', () => this.browserSockets.delete(socket))
      }
      // The admitted Peer must survive this wrapper too: the `/api` upgrade gateway binds its
      // remote session from it, and a missing Peer closes the socket with 1001 instead of
      // answering the renderer, which shows up as an endless reconnect loop.
      return route.handler(request, socket, head, peer)
    } })
  }
}
