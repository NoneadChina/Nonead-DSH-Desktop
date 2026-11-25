/** Keep upstream HTTP routing while requiring Host credentials for browser-reachable routes. */
import { hostLog, hostOperation } from './host/logging.ts'
import WebServer, {
  type WebAuthPolicy,
  type WebAuthRequest,
  type WebAuthenticationRule,
  type WebResourceRoute,
  type WebRoute,
  type WebUpgradeRoute,
} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-client-connection'
import { decideDesktopBrowserAccess, nextBrowserAccess } from './desktop-browser-access.ts'
import type { Duplex } from 'node:stream'
import type { IncomingHttpHeaders } from 'node:http'

/** Route family the embedded Market reaches for every method, reads included. */
const MARKET_ROUTE = '/api/community-market'
/** The login exchange: the only route a browser reaches before it holds a session cookie. */
const PRE_AUTH_ROUTE = '/connect'
/** Methods that cannot change Host state on their own. */
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

const matchesRoute = (path: string, prefix: string): boolean => path === prefix || path.startsWith(`${prefix}/`)

function requestPath(request: Parameters<WebRoute['handler']>[0]): string {
  return new URL(request.url ?? '/', 'http://127.0.0.1').pathname
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
  private permits(request: { readonly headers: IncomingHttpHeaders; readonly url?: string | undefined }): boolean {
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
   * Route authentication policy, declared to the kernel instead of enforced here.
   *
   * 0.2.3 authorizes every request before a handler runs (`webserver/authorize`), so the fence
   * became a per-route `auth` rule. The policy is unchanged from the previous in-wrapper fence:
   * a request has to carry the Host's browser-session cookie (or the in-process API token)
   * unless it is one of the documented exemptions below.
   *
   * - `/connect` is the login exchange. It is the only route a browser reaches before it holds
   *   a cookie, and the connection plugin authenticates its launch token itself, so requiring a
   *   session here would lock every browser out of logging in.
   * - `GET`/`HEAD`/`OPTIONS` on every other family are the login document, its assets and
   *   read-only API responses. The browser gate above already refuses them to ordinary browsers
   *   while browser access is off, so they stay session-free.
   * - `/api/community-market*` keeps the strictest rule it always had: a session is required
   *   for reads too, because the embedded Market shares the renderer's cookie jar.
   * - Every other mutating method (POST/PUT/PATCH/DELETE) changes Host state, so it requires
   *   the session as well. The Electron renderer passes: `main.ts` attaches the session cookie
   *   and `x-dsh-desktop-renderer` token to every forward it makes (the session-wide
   *   `onBeforeSendHeaders` rewrite covers renderer-initiated fetches too).
   */
  private policyFor(path: string, method: string | undefined): 'anonymous' | 'required' {
    if (matchesRoute(path, MARKET_ROUTE)) return 'required'
    if (matchesRoute(path, PRE_AUTH_ROUTE)) return 'anonymous'
    return READ_METHODS.has(method ?? '') ? 'anonymous' : 'required'
  }

  /**
   * The kernel asks this rule before dispatch, which is before the handler can run the browser
   * gate. A request the gate would refuse therefore declares itself anonymous here: the wrapper
   * still answers it with the shell's own `403 Browser access is disabled`, whereas a static
   * `deny` policy would answer `403 forbidden` first and lose that wording.
   */
  /** The kernel hands auth rules a Fetch-shaped request; the gate reads Node headers. */
  private permitsAuthRequest(request: WebAuthRequest): boolean {
    const headers: IncomingHttpHeaders = request.headers instanceof Headers
      ? Object.fromEntries(request.headers.entries())
      : request.headers as IncomingHttpHeaders
    return this.permits({ headers, url: request.url === undefined ? undefined : request.url.href })
  }

  /** The fallback answers any unmatched path, so its policy reads the request path. */
  private readonly fallbackAuth = (request: WebAuthRequest): WebAuthPolicy =>
    this.permitsAuthRequest(request) ? this.policyFor(request.url === undefined ? '/' : request.url.pathname, request.method) : 'anonymous'

  /**
   * The static frontend's fallback seat is a kernel resource, not a handler, so the browser gate
   * cannot answer it: the seat has to express the refusal as a policy. `deny` yields the kernel's
   * own 403, which is what "Browser access is disabled" means for a document; permitting the
   * request keeps `required`, so a browser still needs the Host's session cookie just like the
   * renderer does.
   */
  private readonly resourceFallbackAuth = (request: WebAuthRequest): WebAuthPolicy =>
    this.permitsAuthRequest(request) ? 'required' : 'deny'

  private authRule(path: string): WebAuthenticationRule {
    return request => (this.permitsAuthRequest(request) ? this.policyFor(path, request.method) : 'anonymous')
  }

  /**
   * Resource routes (`{ resource }`) are resolved by the kernel itself, so the shell's in-wrapper
   * browser gate never runs for them and the refusal has to be a policy: `deny` gives the desktop
   * its 403 while browser access is off, and `required` keeps the login document behind the
   * session cookie once browser access is on.
   */
  private resourceAuth(path: string): WebAuthenticationRule {
    return request => (this.permitsAuthRequest(request) ? (matchesRoute(path, PRE_AUTH_ROUTE) ? 'anonymous' : 'required') : 'deny')
  }

  override register(route: WebRoute | WebResourceRoute): () => void {
    // 0.2.3's bundled web clients claim the document as a Fetch resource (`{ resource }`), so the
    // shell's browser gate never runs for them. Wrapping the seat keeps one gate for handlers and
    // resources alike: a request the gate refuses is answered here, and everything else reaches
    // the bundle's own resource (the login page, the app shell, an asset).
    if (!('handler' in route)) {
      const resource = route.resource
      return super.register({
        ...route,
        auth: route.auth ?? this.resourceAuth(route.path),
        resource: async (request, peer) => this.permitsAuthRequest(request as unknown as WebAuthRequest)
          ? resource(request, peer)
          : new Response('Browser access is disabled', { status: 403, headers: { 'cache-control': 'no-store' } }),
      })
    }
    return super.register({
      ...route,
      auth: route.auth ?? this.authRule(route.path),
      handler: this.observeHttp(route.path, async (request, response, peer) => {
        if (!this.permits(request)) { response.writeHead(403, { 'cache-control': 'no-store' }); response.end('Browser access is disabled'); return }
        await route.handler(request, response, peer)
      }),
    })
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
   * Apply the browser gates to the fallback too.
   *
   * 0.2.3's `WebFallback` is a union: a plain handler, or a `{ resource }` seat that the kernel
   * calls itself with a real `Request` through `serveResource`. Resource fallbacks therefore pass
   * through UNCHANGED — rebuilding the request by hand answered the static frontend with a shape
   * it could not serve (404 for every document). Their gate is the kernel default (an omitted
   * `auth` requires a session), which the Desktop Host satisfies only through the
   * `dsh-desktop-session` credential it hands its own renderer; a browser has no such cookie.
   * Handler fallbacks keep the shell's own 403 wording with the browser gate in front.
   */
  override registerFallback(fallback: WebRoute['handler'] | Pick<WebResourceRoute, 'resource'>): () => void {
    hostLog({ source: 'host.http', event: 'fallback.register', fields: { resource: typeof fallback !== 'function' && 'resource' in fallback }, developer: true })
    if (typeof fallback !== 'function' && 'resource' in fallback) return super.registerFallback({ auth: this.resourceFallbackAuth, resource: fallback.resource })
    return super.registerFallback({
      auth: this.fallbackAuth,
      handler: this.observeHttp('fallback', async (request, response, peer) => {
        if (!this.permits(request)) { response.writeHead(403, { 'cache-control': 'no-store' }); response.end('Browser access is disabled'); return }
        await (fallback as WebRoute['handler'])(request, response, peer)
      }),
    })
  }

  override registerUpgrade(route: WebUpgradeRoute): () => void {
    return super.registerUpgrade({ ...route, handler: (request, socket, head, peer) => {
      hostLog({ source: 'host.http', event: 'upgrade', fields: { route: route.path }, developer: true })
      if (!this.permits(request)) { socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'); return }
      // An upgrade owns the socket instead of an HTTP response, so the session fence is the
      // connection plugin's own `admitConnection` — it answers 401/403 on the raw socket for
      // every channel route, including the renderer's. The kernel resolves the route's Peer
      // before dispatch and hands it here as the fourth argument; it must reach the handler or
      // the mux cannot bind the socket to its Peer and closes with 1001 "peer left".
      const access = nextBrowserAccess()
      if (access && decideDesktopBrowserAccess(access, request) === 'browser') {
        this.browserSockets.add(socket)
        socket.once('close', () => this.browserSockets.delete(socket))
      }
      return route.handler(request, socket, head, peer)
    } })
  }
}
