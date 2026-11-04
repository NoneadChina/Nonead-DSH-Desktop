import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import { AA_WORKSPACES } from './agents-anywhere-release-policy.mjs'

// Exercise the installed artifact: a patch file alone does not prove Yarn applied it.
// 打包器会随上游工具链漂移：旧产物用 `//#region <module>.ts` 标注模块边界，新产物（2026-10-29
// 重建的 2.1.0-desktop.c39b82d4…rd9c47cbc）只留 `// <module>.ts` 普通注释。两种都要认，否则
// 门禁会因为注释风格变化而整体报红，而不是因为安装产物真的不对。
const MODULE_MARKERS = [
  /^\/\/#region (src\/[^\s]+\.ts)$/gmu,
  /^\/\/ (src\/[^\s]+\.ts)$/gmu,
]

function moduleSpans(source) {
  const spans = []
  for (const pattern of MODULE_MARKERS) {
    for (const match of source.matchAll(pattern)) spans.push({ module: match[1], start: match.index })
  }
  spans.sort((left, right) => left.start - right.start)
  return spans.map((span, index) => ({ ...span, end: spans[index + 1]?.start ?? source.length }))
}

/** 精确取一个模块的代码：从它的模块标记到下一个模块标记。 */
function moduleSource(source, module) {
  const span = moduleSpans(source).find(candidate => candidate.module === module)
  assert.ok(span !== undefined, `installed bundle does not expose ${module}`)
  return source.slice(span.start, span.end)
}

function bridgeRoot(workspace) {
  return new URL(`../${workspace}/node_modules/@agents-anywhere/dsh-bridge-next/`, import.meta.url)
}

function readBundle(workspace) {
  return readFileSync(new URL('lib/index.js', bridgeRoot(workspace)), 'utf8')
}

function readConnectorFile(workspace, path) {
  return readFileSync(new URL(`lib/bundled-connector/connector/${path}`, bridgeRoot(workspace)), 'utf8')
}

for (const workspace of AA_WORKSPACES) {
  test(`${workspace}: rc.2 tool results retain the same hash after JSON transport`, () => {
    const source = readBundle(workspace)
    const region = name => moduleSource(source, `src/host/dsh-runtime/${name}.ts`)
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

  // AA 2.1（Desktop 2.1.0）只通过 MeshCall 发现 DSH 桥：它读 `~/.agents-anywhere/dsh-bridge/connector.json`，
  // 不再读 1.x 的 HTTP `endpoint.json`。产物必须仍是 MeshCall 桥，否则桌面端会一直显示「等待本地 DSH Bridge」。
  test(`${workspace}: installed bridge publishes the MeshCall connector.json rendezvous`, () => {
    const bundle = readBundle(workspace)
    assert.match(bundle, /from "meshcall"/u)
    assert.ok(bundle.includes('connector.json'), 'bundle must reference the connector.json rendezvous')
    const provider = readConnectorFile(workspace, 'runtimes/dsh/provider_config.py')
    assert.match(provider, /def endpoint_path\(\)[\s\S]*?connector\.json/u)
    // 1.x 的 endpoint.json 只保留为会话身份，不能再作为发现路径。
    assert.match(provider, /def legacy_endpoint_path/u)
  })

  // httpx 只接受裸 IPv6，undici 风格的 `[::1]` 会让 Python 子进程的代理绕过列表失效。
  test(`${workspace}: Python bypass list keeps httpx-compatible IPv6 entries`, () => {
    const bundle = readBundle(workspace)
    const normalized = bundle.match(/replaceAll\("\[::1\]", "::1"\)/gu) ?? []
    assert.ok(normalized.length >= 2, `NO_PROXY and no_proxy must both be normalized, found ${normalized.length}`)
  })

  // 连接器日志在 2.x 里走 MeshCall 的 `aa.local.v2.Logs`，不再经 `connector/log` 帧转发。
  test(`${workspace}: bundled connector serves logs over MeshCall`, () => {
    const logs = readConnectorFile(workspace, 'mesh/logs.py')
    assert.match(logs, /from meshcall import/u)
    const hub = readConnectorFile(workspace, 'mesh/hub.py')
    assert.match(hub, /LOGS_SERVICE/u)
  })
}
