/** Prove the Host HTTP gate fails closed and fences every browser-reachable route family. */
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

const ok = () => (_request: unknown, response: { writeHead(status: number): void; end(body: string): void }) => {
  response.writeHead(200)
  response.end('ok')
}

async function start(context: Context, connection?: { requestRejection(request: unknown): number | undefined }): Promise<NextWebServer> {
  if (connection !== undefined) {
    // The real service answers 401/403; the tests only need its rejection decision.
    context.provide('connection', connection as never)
  }
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

describe('Next WebServer browser gate', () => {
  it('refuses browser traffic when no renderer credential was configured', async () => {
    const server = await start(context())
    server.register({ kind: 'exact', path: '/api/community-market/state', handler: ok() })
    server.registerFallback(ok())

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
    server.register({ kind: 'exact', path: '/renderer', handler: ok() })

    const renderer = await fetch(url(server, '/renderer'), {
      headers: { [DESKTOP_RENDERER_ACCESS_HEADER]: RENDERER_TOKEN },
    })
    const browser = await fetch(url(server, '/renderer'))

    expect(renderer.status).toBe(200)
    expect(browser.status).toBe(403)
    expect(await browser.text()).toBe('Browser access is disabled')
  })
})

describe('Next WebServer connection fence', () => {
  it('requires a Host session for Market reads and writes', async () => {
    configureNextBrowserAccess(RENDERER_TOKEN, true)
    const server = await start(context())
    server.register({ kind: 'prefix', path: '/api/community-market', handler: ok() })

    const read = await fetch(url(server, '/api/community-market/state'))
    const write = await fetch(url(server, '/api/community-market/install'), { method: 'POST' })

    expect(read.status).toBe(503)
    expect(await read.text()).toBe('Market request authentication required')
    expect(write.status).toBe(503)
    expect(await write.text()).toBe('Market request authentication required')
  })

  it('fences non-read methods elsewhere and keeps reads and the login exchange open', async () => {
    configureNextBrowserAccess(RENDERER_TOKEN, true)
    const server = await start(context(), {
      requestRejection: request => ((request as { headers: Record<string, string> }).headers.cookie === undefined ? 401 : undefined),
    })
    server.register({ kind: 'exact', path: '/api/session', handler: ok() })
    server.register({ kind: 'exact', path: '/connect', handler: ok() })

    const read = await fetch(url(server, '/api/session'))
    const write = await fetch(url(server, '/api/session'), { method: 'POST' })
    const authenticated = await fetch(url(server, '/api/session'), { method: 'POST', headers: { cookie: 'session=1' } })
    const login = await fetch(url(server, '/connect'), { method: 'POST' })

    expect(read.status).toBe(200)
    expect(write.status).toBe(401)
    expect(await write.text()).toBe('Request authentication required')
    expect(authenticated.status).toBe(200)
    expect(login.status).toBe(200)
  })

  it('fences the fallback route by its request path', async () => {
    configureNextBrowserAccess(RENDERER_TOKEN, true)
    const server = await start(context(), { requestRejection: () => 403 })
    server.registerFallback(ok())

    const read = await fetch(url(server, '/assets/index.js'))
    const write = await fetch(url(server, '/api/other'), { method: 'DELETE' })

    expect(read.status).toBe(200)
    expect(write.status).toBe(403)
    expect(await write.text()).toBe('Request authentication required')
  })
})
