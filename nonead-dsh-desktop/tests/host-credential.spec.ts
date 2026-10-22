/**
 * Prove the renderer credential travels over the child's private stdin pipe.
 *
 * It must never appear in the child environment (readable through `/proc/<pid>/environ`,
 * crash dumps or the Windows PEB) or in the argument list, so the tests assert both the
 * value the Host receives and the absence of the value everywhere else.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PREFERENCES } from '../src/desktop-contract.ts'
import { NextDesktopRuntime } from '../src/desktop-runtime.ts'
import { DesktopHostProcess } from '../src/host-process.ts'
import { readRendererCredential } from '../src/host/credential.ts'

vi.mock('../src/web-document.ts', async importOriginal => ({
  ...await importOriginal<typeof import('../src/web-document.ts')>(),
  authenticateWebHost: vi.fn(async (_url: string, token: string) => `dsh-session=${token}`),
}))

const TOKEN = Buffer.alloc(32, 5).toString('base64url')

/** A Host that reads the credential from stdin and reports what it received. */
const STDIN_HOST = `
import { createServer } from 'node:http'
const chunks = []
for await (const chunk of process.stdin) chunks.push(chunk)
const credential = Buffer.concat(chunks).toString('utf8').trim()
const server = createServer((request, response) => {
  response.setHeader('content-type', 'application/json')
  response.end(JSON.stringify({
    credential,
    envToken: process.env.DSH_NONEAD_NATIVE_TOKEN ?? null,
    argv: process.argv.slice(2),
    home: process.env.DSH_HOME ?? null,
  }))
})
server.listen(0, '127.0.0.1', () => {
  process.send({ type: 'ready', url: 'http://127.0.0.1:' + server.address().port + '/?token=fixture', injections: [] })
})
process.on('message', message => {
  if (message.type !== 'shutdown') return
  server.close(() => { process.send({ type: 'shutdown-complete' }, () => process.disconnect()) })
  server.closeAllConnections()
})
`

const roots: string[] = []
const hosts: DesktopHostProcess[] = []
const runtimes: NextDesktopRuntime[] = []

afterEach(async () => {
  await Promise.all(hosts.splice(0).map(host => host.stop()))
  await Promise.all(runtimes.splice(0).map(runtime => runtime.close()))
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

/** Layout the packaged shell expects: `<runtime>/node_modules/@deepseek-ai/dsh-desktop-host/lib/index.js`. */
function hostPackage(source = STDIN_HOST): string {
  const project = mkdtempSync(join(tmpdir(), 'dsh-desktop-credential-'))
  roots.push(project)
  const packageRoot = join(project, 'node_modules', '@deepseek-ai', 'dsh-desktop-host')
  mkdirSync(join(packageRoot, 'lib'), { recursive: true })
  writeFileSync(join(packageRoot, 'package.json'), '{"name":"@deepseek-ai/dsh-desktop-host","type":"module"}\n')
  writeFileSync(join(packageRoot, 'lib', 'index.js'), source)
  return project
}

/** Layout `NextDesktopRuntime` launches: `<root>/lib/host.js`. */
function runtimeRoot(source = STDIN_HOST): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-desktop-runtime-credential-'))
  roots.push(root)
  mkdirSync(join(root, 'lib'), { recursive: true })
  writeFileSync(join(root, 'lib', 'host.js'), source)
  return root
}

describe('renderer credential hand-off', () => {
  it('reads exactly one credential line from the private stdin stream', async () => {
    await expect(readRendererCredential(Readable.from([`${TOKEN}\n`]))).resolves.toBe(TOKEN)
    await expect(readRendererCredential(Readable.from([TOKEN]))).resolves.toBe(TOKEN)
    await expect(readRendererCredential(Readable.from([TOKEN.slice(0, 20), TOKEN.slice(20), '\n']))).resolves.toBe(TOKEN)
  })

  it('refuses a missing or malformed credential', async () => {
    await expect(readRendererCredential(Readable.from([])))
      .rejects.toThrow('Next Host did not receive the renderer credential over stdin')
    await expect(readRendererCredential(Readable.from(['\n'])))
      .rejects.toThrow('Next Host did not receive the renderer credential over stdin')
    await expect(readRendererCredential(Readable.from(['short-token\n'])))
      .rejects.toThrow('Next Host received an invalid renderer credential over stdin')
    await expect(readRendererCredential(Readable.from([`${'a'.repeat(300)}\n`])))
      .rejects.toThrow('Next Host received an invalid renderer credential over stdin')
  })

  it('writes the credential to the child stdin instead of its environment', async () => {
    const runtime = hostPackage()
    const host = new DesktopHostProcess(process.execPath, runtime, runtime, undefined, process.env, undefined,
      undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, TOKEN)
    hosts.push(host)

    const { url } = await host.start()
    const body = await (await fetch(new URL('/', url))).json() as {
      credential: string; envToken: string | null; argv: string[]
    }

    expect(body.credential).toBe(TOKEN)
    expect(body.envToken).toBeNull()
    expect(body.argv.join(' ')).not.toContain(TOKEN)
  })

  it('hands the runtime generation credential to the Host it launches', async () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-desktop-credential-home-'))
    roots.push(home)
    const root = runtimeRoot()
    const runtime = new NextDesktopRuntime({
      home, root, executable: process.execPath, addresses: () => ['127.0.0.1'],
      certificate: async () => { throw new Error('LAN certificate is not used by this test') },
      onFailure() {}, onChange() {}, onRestart() {}, onTerminal() {}, onNotification() {},
    })
    runtimes.push(runtime)
    runtime.preferences = { ...DEFAULT_PREFERENCES }

    await runtime.start()
    const auth = runtime.auth
    expect(auth).toBeDefined()
    const body = await (await fetch(new URL('/', auth!.url))).json() as {
      credential: string; envToken: string | null; argv: string[]; home: string | null
    }

    expect(body.credential).toBe(auth!.token)
    expect(body.envToken).toBeNull()
    expect(body.argv.join(' ')).not.toContain(auth!.token)
    expect(body.home).toBe(home)
  })
})
