/** Prove the Host HTTP gate fails closed and that every browser-reachable route family carries the session policy the wrapper declares. */
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { Peer } from '@deepseek-ai/dsh-client-connection'
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

async function start(context: Context): Promise<NextWebServer> {
  // Stand in for the `connection` plugin, which is the only kernel authorize provider: an anonymous
  // route is admitted as-is, anything else has to carry a session credential.
  const peer = new Peer(context, { principal: { kind: 'owner' }, interactions: 'none' })
  context.effect(() => () => { void peer.dispose() }, 'next webserver fixture peer')
  context.on('webserver/authorize', (request, policy) => {
    const cookie = request.headers instanceof Headers
      ? request.headers.get('cookie')
      : request.headers.cookie
    return policy === 'anonymous' || cookie !== undefined
      ? { kind: 'allow', peer }
      : { kind: 'deny', status: 401 }
  })
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
    server.register({ kind: 'exact', path: '/api/community-market/state', handler: ok(), auth: 'anonymous' })
    server.registerFallback({ handler: ok(), auth: 'anonymous' })

    // The session credential is supplied so the answer under test comes from the browser-access
    // gate, which runs after the kernel has admitted the request.
    const market = await fetch(url(server, '/api/community-market/state'), { headers: { cookie: 'session=1' } })
    const other = await fetch(url(server, '/anything'), { headers: { cookie: 'session=1' } })

    expect(market.status).toBe(403)
    expect(await market.text()).toBe('Browser access is disabled')
    expect(other.status).toBe(403)
    expect(await other.text()).toBe('Browser access is disabled')
  })

  it('keeps the renderer capability working while ordinary browsers are disabled', async () => {
    configureNextBrowserAccess(RENDERER_TOKEN, false)
    const server = await start(context())
    server.register({ kind: 'exact', path: '/renderer', handler: ok(), auth: 'anonymous' })

    const renderer = await fetch(url(server, '/renderer'), {
      headers: { [DESKTOP_RENDERER_ACCESS_HEADER]: RENDERER_TOKEN },
    })
    const browser = await fetch(url(server, '/renderer'))

    expect(renderer.status).toBe(200)
    expect(browser.status).toBe(403)
    expect(await browser.text()).toBe('Browser access is disabled')
  })
})

describe('Next WebServer session policy', () => {
  it('requires a Host session for Market reads as well as writes', async () => {
    configureNextBrowserAccess(RENDERER_TOKEN, true)
    const server = await start(context())
    server.register({ kind: 'prefix', path: '/api/community-market', handler: ok(), auth: 'anonymous' })

    const read = await fetch(url(server, '/api/community-market/state'))
    const write = await fetch(url(server, '/api/community-market/install'), { method: 'POST' })

    // The declared `anonymous` is the Market's own registration; the wrapper upgrades it, which is
    // why the kernel — not this plugin — answers with its standard refusal.
    expect(read.status).toBe(401)
    expect(await read.text()).toBe('unauthorized')
    expect(write.status).toBe(401)
    expect(await write.text()).toBe('unauthorized')
  })

  it('fences non-read methods elsewhere and keeps reads and the login exchange open', async () => {
    configureNextBrowserAccess(RENDERER_TOKEN, true)
    const server = await start(context())
    server.register({ kind: 'exact', path: '/api/session', handler: ok(), auth: 'anonymous' })
    server.register({ kind: 'exact', path: '/connect', handler: ok(), auth: 'anonymous' })

    const read = await fetch(url(server, '/api/session'))
    const write = await fetch(url(server, '/api/session'), { method: 'POST' })
    const authenticated = await fetch(url(server, '/api/session'), { method: 'POST', headers: { cookie: 'session=1' } })
    const login = await fetch(url(server, '/connect'), { method: 'POST' })

    expect(read.status).toBe(200)
    expect(write.status).toBe(401)
    expect(await write.text()).toBe('unauthorized')
    expect(authenticated.status).toBe(200)
    expect(login.status).toBe(200)
  })

  it('fences the fallback route by its request path and keeps its declared policy otherwise', async () => {
    configureNextBrowserAccess(RENDERER_TOKEN, true)
    const server = await start(context())
    server.registerFallback({ handler: ok(), auth: 'anonymous' })

    const read = await fetch(url(server, '/assets/index.js'))
    const write = await fetch(url(server, '/api/other'), { method: 'DELETE' })

    expect(read.status).toBe(200)
    expect(write.status).toBe(401)
    expect(await write.text()).toBe('unauthorized')
  })
})
