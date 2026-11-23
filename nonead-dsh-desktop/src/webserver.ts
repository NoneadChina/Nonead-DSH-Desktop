/** Keep upstream HTTP routing while requiring Host credentials for browser-reachable routes. */
import { hostLog, hostOperation } from './host/logging.ts'
import WebServer, { type WebAuthenticationRule, type WebAuthPolicy, type WebAuthRequest, type WebEntryUrl, type WebFallback, type WebResource, type WebResourceRoute, type WebRoute, type WebUpgradeRoute } from '@deepseek-ai/dsh-host-webserver'
import type { Context } from '@deepseek-ai/cordis'
import { decideDesktopBrowserAccess, nextBrowserAccess } from './desktop-browser-access.ts'
import type { Duplex } from 'node:stream'

/** Route family the embedded Market reaches for every method, reads included. */
const MARKET_ROUTE = '/api/community-market'
/** The login exchange: the only route a browser reaches before it holds a session cookie. */
const PRE_AUTH_ROUTE = '/connect'
/** Methods that cannot change Host state on their own. */
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

const matchesRoute = (path: string, prefix: string): boolean => path === prefix || path.startsWith(`${prefix}/`)

/**
 * The address this fork shows an ordinary browser.
 *
 * The native window never needs it: the parent process hands that window a session Cookie
 * (`host-authentication-desktop`). A browser cannot be handed that Credential, so it still goes
 * through the kernel's one-time login token, which the token plugin contributes here. When no
 * plugin offers one, the bare root is returned and the kernel answers with its own login page
 * instead of this fork inventing a credential.
 */
export function nextBrowserLoginUrl(ctx: Context, baseUrl: string): string {
  const entries: WebEntryUrl[] = []
  ctx.emit(ctx.webServer, 'webserver/entry-url', baseUrl, entries)
  return entries.find(entry => entry.url !== baseUrl)?.url ?? baseUrl
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

  /**
   * Turn the session rule into the route's own kernel policy instead of admitting requests here.
   *
   * `dsh 0.2.3-alpha.2` authorizes every route before its responder runs, and the `connection`
   * plugin owns that decision. Reaching for `connection.admit` from a wrapped responder instead —
   * one that another plugin registered, the Market for `/api/community-market*` — threw before any
   * responder wrote a status: cordis resolves a service read through the injection surface of the
   * calling plugin, which does not cover the `connection.authentication` read `admit` performs on
   * its own service. Every `/api` RPC call then hung until the client's header timeout fired
   * (300 s in the Host smoke), and Market reads fell back to the kernel's per-request 400. Declaring
   * the policy hands the admission to the kernel, which answers 401/403/503 with its own body and
   * passes the live Peer to the responder.
   */
  private authRule(declared: WebAuthenticationRule | undefined): (request: WebAuthRequest) => WebAuthPolicy {
    const declaredRule = (request: WebAuthRequest): WebAuthPolicy =>
      typeof declared === 'function' ? declared(request) : declared ?? 'required'
    return request => this.requiresSession(request.url.pathname, request.method) ? 'required' : declaredRule(request)
  }

  override register(route: WebRoute | WebResourceRoute): () => void {
    if ('resource' in route) {
      // `dsh 0.2.2-rc.1` serves static assets as Fetch resources instead of Node handlers, so the
      // renderer capability arrives as a header and the gate has to answer with a `Response`.
      // Every other registration field is kept, so only the responder and the session policy change.
      return super.register({
        ...route,
        auth: this.authRule(route.auth),
        resource: this.observeResource(String(route.path), async (request, peer) => {
          if (!this.permitsResource(request)) return new Response('Browser access is disabled', { status: 403, headers: { 'cache-control': 'no-store' } })
          return await route.resource(request, peer)
        }),
      })
    }
    return super.register({ ...route, auth: this.authRule(route.auth), handler: this.observeHttp(route.path, async (request, response, peer) => {
      if (!this.permits(request)) { response.writeHead(403, { 'cache-control': 'no-store' }); response.end('Browser access is disabled'); return }
      // The admitted Peer belongs to the route contract: the connection plugin's `/api` RPC channel
      // answers nothing at all when it is called without one, so dropping it hung every RPC call.
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
   * Apply the browser gates to the fallback while keeping the seat's own shape.
   *
   * `dsh 0.2.2-alpha.2` and later register the frontend fallback as `{ resource }` instead of a
   * plain handler. Rewriting that seat as a handler used to be necessary to run the gates, but it
   * costs more than it buys: `readResource` — how the `/` login document renders the SPA index for
   * the admitted Peer — answers 404 whenever the fallback seat holds a handler, so a valid session
   * cookie still got no page. Wrapping the resource instead keeps both gates and leaves the seat
   * readable, and the kernel supplies the Fetch request and the admitted Peer on its own
   * (`serveResource`), so the hand-built request and second admission are gone with it.
   */
  override registerFallback(fallback: WebRoute['handler'] | WebFallback): () => void {
    const declaredAuth = typeof fallback === 'function' ? undefined : fallback.auth
    if (typeof fallback !== 'function' && 'resource' in fallback) {
      const resource = this.observeResource('fallback', async (request, peer) => {
        if (!this.permitsResource(request)) return new Response('Browser access is disabled', { status: 403, headers: { 'cache-control': 'no-store' } })
        return await fallback.resource(request, peer)
      })
      return super.registerFallback({ resource, auth: this.authRule(declaredAuth) })
    }
    const handler = this.observeHttp('fallback', async (request, response, peer) => {
      if (!this.permits(request)) { response.writeHead(403, { 'cache-control': 'no-store' }); response.end('Browser access is disabled'); return }
      await (typeof fallback === 'function' ? fallback : fallback.handler!)(request, response, peer)
    })
    return super.registerFallback({ handler, auth: this.authRule(declaredAuth) })
  }

  override registerUpgrade(route: WebUpgradeRoute): () => void {
    return super.registerUpgrade({ ...route, handler: (request, socket, head, peer) => {
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
      return route.handler(request, socket, head, peer)
    } })
  }
}
