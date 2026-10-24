/** Keep upstream HTTP routing while requiring Host credentials for browser-reachable routes. */
import { hostLog, hostOperation } from './host/logging.ts'
import WebServer, { type WebRoute, type WebUpgradeRoute } from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-client-connection'
import { decideDesktopBrowserAccess, nextBrowserAccess } from './desktop-browser-access.ts'
import type { Duplex } from 'node:stream'

/** Route family the embedded Market reaches for every method, reads included. */
const MARKET_ROUTE = '/api/community-market'
/** The login exchange: the only route a browser reaches before it holds a session cookie. */
const PRE_AUTH_ROUTE = '/connect'
/** Methods that cannot change Host state on their own. */
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

const matchesRoute = (path: string, prefix: string): boolean => path === prefix || path.startsWith(`${prefix}/`)

function requestPath(request: Parameters<WebRoute['handler']>[0]): string {
  if (request.url === undefined) return '/'
  try {
    return new URL(request.url, 'http://127.0.0.1').pathname
  } catch {
    return '/'
  }
}

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
    if (!unavailablePolicyReported) {
      unavailablePolicyReported = true
      hostLog({ source: 'host.http', event: 'browser-access.unavailable', level: 'warn',
        message: 'The renderer credential is unavailable, so browser requests are refused' })
    }
    return false
  }

  /**
   * Decide whether a route family may answer without an authenticated Host session.
   *
   * Every family reachable from an ordinary browser is fenced uniformly: a request has to
   * carry the Host's browser-session cookie (or the in-process API token) unless the route is
   * one of the documented exemptions below.
   *
   * - `/connect` is the login exchange. It is the only route a browser reaches before it holds
   *   a cookie, and the connection plugin authenticates its launch token itself, so fencing it
   *   here would lock every browser out of logging in.
   * - `GET`/`HEAD`/`OPTIONS` on every other family are the login document, its assets and
   *   read-only API responses. The HTTP gate above already refuses them to ordinary browsers
   *   while browser access is off, so they stay session-free.
   * - `/api/community-market*` keeps the strictest rule it always had: a session is required
   *   for reads too, because the embedded Market shares the renderer's cookie jar.
   * - Every other mutating method (POST/PUT/PATCH/DELETE) changes Host state, so it requires
   *   the session as well. The Electron renderer passes: `main.ts` attaches the session cookie
   *   and `x-dsh-desktop-renderer` token to every forward it makes (the session-wide
   *   `onBeforeSendHeaders` rewrite covers renderer-initiated fetches too).
   */
  private requiresSession(path: string, method: string | undefined): boolean {
    if (matchesRoute(path, MARKET_ROUTE)) return true
    if (matchesRoute(path, PRE_AUTH_ROUTE)) return false
    return !READ_METHODS.has(method ?? '')
  }

  /** Write the fence's refusal, keeping the Market wording its clients already report. */
  private refuse(response: Parameters<WebRoute['handler']>[1], path: string, rejection: number): void {
    response.writeHead(rejection, { 'cache-control': 'no-store' })
    response.end(matchesRoute(path, MARKET_ROUTE) ? 'Market request authentication required' : 'Request authentication required')
  }

  /** Apply the connection fence to one route family. */
  private fence(path: string, request: Parameters<WebRoute['handler']>[0], response: Parameters<WebRoute['handler']>[1]): boolean {
    if (!this.requiresSession(path, request.method)) return false
    const connection = this.ctx.get('connection')
    const rejection = connection === undefined ? 503 : connection.requestRejection(request)
    if (rejection === undefined) return false
    this.refuse(response, path, rejection)
    return true
  }

  override register(route: WebRoute): () => void {
    return super.register({ ...route, handler: this.observeHttp(route.path, async (request, response) => {
      if (!this.permits(request)) { response.writeHead(403, { 'cache-control': 'no-store' }); response.end('Browser access is disabled'); return }
      if (this.fence(route.path, request, response)) return
      await route.handler(request, response)
    }) })
  }

  private observeHttp(route: string, handler: WebRoute['handler']): WebRoute['handler'] {
    return async (request, response) => {
      const end = hostOperation('host.http', 'request', { route, method: request.method ?? '' }, true)
      const finish = () => { end(undefined, { status: response.statusCode, aborted: !response.writableFinished }); response.off('finish', finish); response.off('close', finish) }
      response.once('finish', finish); response.once('close', finish)
      try { await handler(request, response) } catch (error) { response.off('finish', finish); response.off('close', finish); end(error); throw error }
    }
  }

  override registerFallback(handler: WebRoute['handler']): () => void {
    return super.registerFallback(this.observeHttp('fallback', async (request, response) => {
      if (!this.permits(request)) { response.writeHead(403, { 'cache-control': 'no-store' }); response.end('Browser access is disabled'); return }
      if (this.fence(requestPath(request), request, response)) return
      await handler(request, response)
    }))
  }

  override registerUpgrade(route: WebUpgradeRoute): () => void {
    return super.registerUpgrade({ ...route, handler: (request, socket, head) => {
      hostLog({ source: 'host.http', event: 'upgrade', fields: { route: route.path }, developer: true })
      if (!this.permits(request)) { socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'); return }
      // An upgrade owns the socket instead of an HTTP response, so the session fence is the
      // connection plugin's own `admitConnection` — it answers 401/403 on the raw socket for
      // every channel route, including the renderer's.
      const access = nextBrowserAccess()
      if (access && decideDesktopBrowserAccess(access, request) === 'browser') {
        this.browserSockets.add(socket)
        socket.once('close', () => this.browserSockets.delete(socket))
      }
      return route.handler(request, socket, head)
    } })
  }
}
