import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { access, cp, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, sep } from 'node:path'
import { PassThrough } from 'node:stream'
import { test } from 'node:test'
import { promisify, stripVTControlCharacters } from 'node:util'
import { runInNewContext } from 'node:vm'
import { AA_WORKSPACES } from './agents-anywhere-release-policy.mjs'

// Exercise the installed artifact: a patch file alone does not prove Yarn applied it.
function loadConnector(workspace, environment) {
  const source = readFileSync(new URL(`../${workspace}/node_modules/@agents-anywhere/dsh-bridge-next/lib/index.js`, import.meta.url), 'utf8')
  // A module section runs from its own marker up to the next one.
  const section = marker => {
    const start = source.indexOf(marker)
    assert.ok(start >= 0, `missing bundle section ${marker}`)
    const end = source.indexOf('// src/', start + 1)
    return source.slice(start, end < 0 ? undefined : end)
  }
  // The connector builds its diagnostics and log sinks from earlier sections and
  // derives its environment with self-contained helpers from sibling modules. Whole
  // sections are unusable here: environment.ts evaluates `import.meta` at load time.
  const extractFunction = name => {
    const head = source.indexOf(`function ${name}(`)
    assert.ok(head >= 0, `missing bundle function ${name}`)
    const tail = source.indexOf('\n}\n', head)
    assert.ok(tail > head, `unterminated bundle function ${name}`)
    return source.slice(head, tail + 2)
  }
  const extractConstant = name => {
    const match = new RegExp(`^const ${name} = .*$`, 'm').exec(source)
    assert.ok(match, `missing bundle constant ${name}`)
    return match[0]
  }
  const extractBlock = name => {
    const head = source.indexOf(`const ${name} = {`)
    assert.ok(head >= 0, `missing bundle block ${name}`)
    const tail = source.indexOf('\n};', head)
    assert.ok(tail > head, `unterminated bundle block ${name}`)
    return source.slice(head, tail + 3)
  }
  const helpers = [
    ...['record', 'withPackageIndexes'].map(extractFunction),
    ...['PYPI_SIMPLE'].map(extractConstant),
    ...['DEFAULT_CONNECTOR_SETTINGS'].map(extractBlock),
  ].join('\n')
  const dependencies = [
    '// src/host/dsh-runtime/errors.ts',
    '// src/host/dsh-runtime/diagnostics.ts',
    '// src/host/dsh-runtime/log-output.ts',
  ].map(section).join('') + helpers
  const start = source.indexOf('// src/host/connector/logs.ts')
  const end = source.indexOf('// src/host/desktop/detect.ts', start)
  assert.ok(start >= 0 && end > start)
  const sliced = `${dependencies}\n${source.slice(start, end)}`
  // The connector reports RPC failures through MeshCall's application error.
  class MeshCallError extends Error {
    constructor(code, message, details) {
      super(message)
      this.code = code
      this.details = details
    }
  }
  return runInNewContext(`${sliced}; SourceConnector`, {
    execFile, promisify, stripVTControlCharacters, join, relative, createHash, randomUUID, setTimeout, clearTimeout,
    MeshCallError,
    // `node:timers/promises` arrives in the bundle as a renamed import binding.
    'setTimeout$1': ms => new Promise(resolve => setTimeout(resolve, ms)),
    access, cp, mkdtemp, readFile, readdir, rename, rm,
    process: { platform: process.platform, env: environment },
    readJson$1: async () => [], writeJson: async () => {}, mkdir,
    resolveUv: async () => 'uv',
  })
}

for (const workspace of AA_WORKSPACES) {
  test(`${workspace}: rc.2 tool results retain the same hash after JSON transport`, () => {
    const source = readFileSync(new URL(`../${workspace}/node_modules/@agents-anywhere/dsh-bridge-next/lib/index.js`, import.meta.url), 'utf8')
    const region = name => {
      const start = source.indexOf(`// src/host/dsh-runtime/${name}.ts`)
      const next = source.indexOf('// src/', start + 1)
      const end = next < 0 ? source.length : next
      assert.ok(start >= 0 && end > start)
      return source.slice(start, end)
    }
    const { createProjection, contentHash } = runInNewContext(
      // types carries the JSON helpers history applies before hashing, including lone-surrogate normalization.
      ['types', 'identity', 'tools', 'history'].map(region).join('\n') + ';({ createProjection, contentHash })',
      { createHash, Buffer },
    )
    const projection = createProjection('native-session', 'platform-session')
    projection.apply({ type: 'tool/result', seq: 0, time: '2026-09-24T00:00:00Z',
      data: { message: { role: 'tool', toolCallId: 'call-1', content: [] }, meta: {} } })
    const item = JSON.parse(JSON.stringify(projection.snapshot()[0]))
    // Python json.dumps(..., sort_keys=True, separators=(',', ':')) for this payload.
    const canonical = '{"content":{"callId":"call-1","dshResultMeta":{},"input":{},"isError":false,"kind":"tool_call","output":"","result":[],"title":"tool","toolName":"tool"},"role":"assistant","status":"done","type":"tool"}'
    assert.equal(item.contentHash, `sha256:${createHash('sha256').update(canonical).digest('hex')}`)
    assert.equal(item.content.callId, 'call-1')
    // Optional fields omitted by JSON must not change the hash sent to Python.
    assert.equal(contentHash({ ...item, content: { ...item.content, optional: undefined } }), item.contentHash)
    // A lone surrogate an old plugin sends is normalized before the hash Python recomputes from UTF-8.
    projection.apply({ type: 'tool/result', seq: 1, time: '2026-09-24T00:00:01Z',
      data: { message: { role: 'tool', toolCallId: 'call-2', content: [{ type: 'text', text: 'ok\uD800' }] }, meta: {} } })
    const normalized = JSON.parse(JSON.stringify(projection.snapshot().find(entry => entry.content.callId === 'call-2')))
    assert.equal(normalized.content.output, 'ok\uFFFD')
    assert.equal(normalized.content.result[0].text, 'ok\uFFFD')
    assert.equal(normalized.contentHash, contentHash(normalized))
    assert.throws(() => projection.apply({ type: 'tool/result', seq: 2, time: '2026-09-24T00:00:02Z',
      data: { message: { content: [{}] }, meta: {} } }), /Invalid DSH tool result message/)
  })

  test(`${workspace}: Python gets a compatible bypass list and a writable project copy`, async t => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-aa-connector-'))
    t.after(() => rm(root, { recursive: true, force: true }))
    const source = join(root, 'package', 'connector-source')
    const stateRoot = join(root, 'state')
    await mkdir(join(source, 'connector'), { recursive: true })
    await writeFile(join(source, 'pyproject.toml'), '[project]\nname = "fixture"\n')
    await writeFile(join(source, 'connector', 'cli.py'), '# fixture\n')
    const env = {
      NO_PROXY: 'localhost,127.0.0.1,::1,[::1],.example.com',
      no_proxy: 'internal.test, [::1] ',
      HTTPS_PROXY: 'http://127.0.0.1:7890',
    }
    const original = { ...env }
    const Connector = loadConnector(workspace, env)
    // The launch environment and the project copy are decided before the ready
    // handshake, so the stub child never answers and start() is expected to time
    // out: the assertions below are exactly what it had published by then.
    const child = new EventEmitter()
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    child.stdin = new EventEmitter()
    child.stdin.write = () => {}
    // stop() ends stdin and then waits for the child to close; without a pid it
    // never gets a kill (and must not: taskkill would target that pid), so the
    // stub reports its own close when the plugin closes the channel.
    child.stdin.end = () => queueMicrotask(() => child.emit('close', null))
    child.exitCode = null
    child.signalCode = null
    child.kill = () => {}
    let launched, launchedArgs
    // The failure path prunes the uv cache through a real `uv` process; the
    // subject here is the launch environment and the project copy.
    const connector = new Connector({ stateRoot, connectorSourceDir: source, uvPath: 'uv' },
      (_command, args, options) => { launched = options; launchedArgs = args; return child },
      undefined, 250, async () => {})
    await assert.rejects(
      connector.start({ connectorId: 'device', connectorToken: 'private-test-token' }, 'https://example.com', new AbortController().signal),
      /Connector 响应超时/)
    assert.equal(connector.running, false)
    assert.equal(launched.env.NO_PROXY, 'localhost,127.0.0.1,::1,::1,.example.com')
    // 2.2.0 only rewrites the bracketed IPv6 literal: it does not trim the list.
    assert.equal(launched.env.no_proxy, 'internal.test, ::1 ')
    assert.equal(launched.env.HTTPS_PROXY, env.HTTPS_PROXY)
    assert.deepEqual(env, original)
    assert.ok(launched.cwd.startsWith(join(stateRoot, 'connector-source') + sep))
    assert.equal(launchedArgs[launchedArgs.indexOf('--directory') + 1], launched.cwd)
    assert.equal(await readFile(join(launched.cwd, 'connector', 'cli.py'), 'utf8'), '# fixture\n')
    await writeFile(join(launched.cwd, 'uv.lock'), 'fixture lock\n')
    await assert.rejects(access(join(source, 'uv.lock')), { code: 'ENOENT' })
    await connector.logs.flush()
  })

  test(`${workspace}: startup failures reach logs and credentials stay redacted`, async t => {
    const stateRoot = await mkdtemp(join(tmpdir(), 'dsh-aa-logs-'))
    t.after(() => rm(stateRoot, { recursive: true, force: true }))
    const Connector = loadConnector(workspace, {})
    const connector = new Connector({ stateRoot }, () => {})
    await connector.logs.startSession(['private-test-token'])
    // The bridge only speaks the rendezvous handshake on its ready channel, so a
    // JSON-RPC frame there is a startup failure, and that failure has to be logged.
    const frame = JSON.stringify({ jsonrpc: '2.0', method: 'connector/log', params: {
      level: 'ERROR', message: "Invalid port: ':1]' private-test-token",
      exception: 'InvalidURL private-test-token',
    } }) + '\n'
    connector.receive(frame.slice(0, 31))
    connector.receive(frame.slice(31))
    await connector.logs.flush()
    const lines = Array.from(connector.logs.entries, entry => entry.text)
    assert.deepEqual(lines, ['[process] process_error'])
    assert.equal(connector.failure?.message, 'Connector 返回了无效的启动消息。')
    // Connector output is redacted before it is retained, whatever carried the secret.
    connector.logs.output("[connector] ERROR: Invalid port: ':1]' private-test-token\n")
    connector.logs.output('InvalidURL private-test-token\n')
    await connector.logs.flush()
    const redacted = Array.from(connector.logs.entries, entry => entry.text).slice(-2)
    assert.deepEqual(redacted, ["[connector] ERROR: Invalid port: ':1]' [REDACTED]", 'InvalidURL [REDACTED]'])
  })
}
