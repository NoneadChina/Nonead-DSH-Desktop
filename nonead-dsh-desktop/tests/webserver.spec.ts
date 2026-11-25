/** Prove the Host HTTP gate fails closed and forwards the kernel's own route authentication. */
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import {
  configureNextBrowserAccess,
  DESKTOP_RENDERER_ACCESS_HEADER,
} from '../src/desktop-browser-access.ts'
import NextWebServer from '../src/webserver.ts'

const RENDERER_TOKEN = Buffer.alloc(32, 11).toString('base64url')

const contexts: Context[] = []

afterEach(async () => {
  configureNextBrowserAccess(undefined, false)
  await Promise.all(contexts.splice(0).map(context => context.fiber.dispose()))
})

type PlainResponse = { writeHead(status: number): void; end(body: string): void }

const ok = () => (_request: unknown, response: PlainResponse) => {
  response.writeHead(200)
  response.end('ok')
}

async function start(context: Context): Promise<NextWebServer> {
  await context.plugin(NextWebServer, { host: '127.0.0.1', port: 0 })
  const webServer = context.get('webServer')
  if (!(webServer instanceof NextWebServer)) throw new Error('Next WebServer did not start')
  return webServer
}

function context(): Context {
  const created = new Context()
  contexts.push(created)
  return created
}

const url = (server: NextWebServer, path: string): string => `http://127.0.0.1:${String(server.port)}${path}`

const rendererHeaders = { [DESKTOP_RENDERER_ACCESS_HEADER]: RENDERER_TOKEN }

describe('Next WebServer browser gate', () => {
  it('refuses browser traffic when no renderer credential was configured', async () => {
    const server = await start(context())
    server.register({ kind: 'exact', path: '/api/community-market/state', auth: 'anonymous', handler: ok() })
    server.registerFallback({ auth: 'anonymous', handler: ok() })

    const market = await fetch(url(server, '/api/community-market/state'))
    const other = await fetch(url(server, '/anything'))

    expect(market.status).toBe(403)
    expect(await market.text()).toBe('Browser access is disabled')
    expect(other.status).toBe(403)
    expect(await other.text()).toBe('Browser access is disabled')
  })

  it('keeps the renderer capability working while ordinary browsers are disabled', async () => {
    configureNextBrowserAccess(RENDERER_TOKEN, false)
    const server = await start(context())
    server.register({ kind: 'exact', path: '/renderer', auth: 'anonymous', handler: ok() })

    const renderer = await fetch(url(server, '/renderer'), { headers: rendererHeaders })
    const browser = await fetch(url(server, '/renderer'))

    expect(renderer.status).toBe(200)
    expect(browser.status).toBe(403)
    expect(await browser.text()).toBe('Browser access is disabled')
  })
})

/**
 * The shell owns only the browser gate: the kernel's connection waterfall decides whether an
 * ordinary browser holds a Host session, and these cases pin that the wrapper does not replace it.
 */
describe('Next WebServer kernel authentication passthrough', () => {
  it('leaves the kernel default policy on routes that do not ask for anonymity', async () => {
    configureNextBrowserAccess(RENDERER_TOKEN, true)
    const server = await start(context())
    server.register({ kind: 'exact', path: '/api/session', handler: ok() })

    // A bare Context has no connection plugin, so the kernel cannot admit the request at all.
    const response = await fetch(url(server, '/api/session'), { headers: rendererHeaders })

    expect(response.status).toBe(503)
    expect(await response.text()).toBe('authentication unavailable')
  })

  it('forwards routes that declare anonymity to their handler', async () => {
    configureNextBrowserAccess(RENDERER_TOKEN, true)
    const server = await start(context())
    server.register({ kind: 'exact', path: '/api/public', auth: 'anonymous', handler: ok() })

    const response = await fetch(url(server, '/api/public'), { headers: rendererHeaders })

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('ok')
  })

  it('leaves the kernel default policy on the fallback', async () => {
    configureNextBrowserAccess(RENDERER_TOKEN, true)
    const server = await start(context())
    server.registerFallback(ok())

    const renderer = await fetch(url(server, '/anything'), { headers: rendererHeaders })
    const browser = await fetch(url(server, '/anything'))

    // The kernel answers before the shell gate runs, so an unauthenticated fallback denies both.
    expect(renderer.status).toBe(503)
    expect(await renderer.text()).toBe('authentication unavailable')
    expect(browser.status).toBe(503)
  })

  it('applies the browser gate to fallbacks that declare anonymity', async () => {
    configureNextBrowserAccess(RENDERER_TOKEN, false)
    const server = await start(context())
    server.registerFallback({ auth: 'anonymous', handler: ok() })

    const renderer = await fetch(url(server, '/anything'), { headers: rendererHeaders })
    const browser = await fetch(url(server, '/anything'))

    expect(renderer.status).toBe(200)
    expect(await renderer.text()).toBe('ok')
    expect(browser.status).toBe(403)
    expect(await browser.text()).toBe('Browser access is disabled')
  })
})
