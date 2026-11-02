import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseBilingualRecord } from './bilingual-docs.mjs'
import { verifyLanguageReleaseParity, verifyUpstreamReference } from './release-pins.mjs'

const root = resolve(import.meta.dirname, '..')
const readJson = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'))
const run = (command, args, cwd = root) => execFileSync(command, args, {
  cwd,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
}).trim()
const fail = message => { throw new Error(`verify-layout: ${message}`) }

const workspace = readJson('package.json')
const upstream = readJson('upstream.json')
const betaPlugin = readJson('dsh-plugin-desktop-beta/package.json')
const nextDesktop = readJson('nonead-dsh-desktop/package.json')
const nextReference = readJson('nonead-dsh-desktop/upstream-reference.json')
const fabric = readJson('dsh-community-fabric/package.json')
const market = readJson('dsh-community-market/package.json')
// Both shells ship one product from one release, so their versions move together and the newest
// CHANGELOG entry is the version that was actually built. This runs before the upstream checkout is
// read: releasing must not depend on the submodule being initialized.
const released = /^## (\d+\.\d+\.\d+) — \d{4}-\d{2}-\d{2}$/mu.exec(
  readFileSync(resolve(root, 'CHANGELOG.md'), 'utf8'),
)?.[1]
if (released === undefined) fail('CHANGELOG.md must lead with a "## <version> — <date>" release heading')
for (const [name, manifest] of [
  ['dsh-plugin-desktop-beta', betaPlugin],
  ['nonead-dsh-desktop', nextDesktop],
]) {
  if (manifest.version !== released) fail(`${name} must ship the newest CHANGELOG.md release ${released}, not ${manifest.version}`)
}
// `.i18n.yaml` 是语言集合的真源：记录里声明的每个语言都必须带上当前发布版本。
// 只刷新记录里的哈希发现不了「某个语言的 CHANGELOG 落后 / README 忘了改号」——
// 哈希对所有语言一致刷新后门禁依然全绿。
for (const [recordFile, headings] of [['CHANGELOG.i18n.yaml', true], ['README.i18n.yaml', false]]) {
  verifyLanguageReleaseParity({
    recordPath: recordFile,
    entries: parseBilingualRecord(recordFile, readFileSync(resolve(root, recordFile), 'utf8')),
    readDocument: filename => readFileSync(resolve(root, filename), 'utf8'),
    version: released,
    headings,
  })
}
const upstreamPackage = readJson('deepseek-harness/package.json')

if (betaPlugin.name !== 'dsh-plugin-desktop-beta') fail('the Beta Desktop workspace must publish as dsh-plugin-desktop-beta')
if (!['stable', 'beta'].includes(upstream.activeChannel)) fail('the pinned upstream checkout must follow a declared release channel')
const activeUpstream = upstream.channels?.[upstream.activeChannel]
if (activeUpstream === undefined) fail('the active upstream channel is missing')

if (workspace.packageManager !== 'yarn@4.18.0') {
  fail('the product workspace must pin yarn@4.18.0')
}
// The former Stable Desktop workspace (dsh-plugin-desktop) was removed; Beta,
// Next, Fabric and the Market are the Desktop workspaces that remain.
if (JSON.stringify(workspace.workspaces) !== JSON.stringify([
  'dsh-plugin-desktop-beta',
  'nonead-dsh-desktop',
  'dsh-community-fabric',
  'dsh-community-market',
])) {
  fail('the root Yarn workspace must contain the beta desktop, community-fabric, and community-market packages')
}
for (const [name, manifest] of [
  ['dsh-plugin-desktop-beta', betaPlugin],
  ['nonead-dsh-desktop', nextDesktop],
  ['dsh-community-fabric', fabric],
  ['dsh-community-market', market],
]) {
  if (manifest.packageManager !== undefined) fail(`${name} must inherit the root Yarn release`)
}
if (fabric.name !== 'dsh-community-fabric') fail('the Fabric workspace must own dsh-community-fabric')
if (market.name !== 'dsh-community-market') fail('the market workspace must own dsh-community-market')
for (const legacyFile of [
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'dsh-plugin-desktop-beta/pnpm-lock.yaml',
  'dsh-plugin-desktop-beta/pnpm-workspace.yaml',
  'nonead-dsh-desktop/pnpm-lock.yaml',
  'nonead-dsh-desktop/pnpm-workspace.yaml',
  'dsh-community-fabric/pnpm-lock.yaml',
  'dsh-community-fabric/pnpm-workspace.yaml',
  'dsh-community-market/pnpm-lock.yaml',
  'dsh-community-market/pnpm-workspace.yaml',
]) {
  if (existsSync(resolve(root, legacyFile))) fail(`${legacyFile} must not exist`)
}
if (run('git', ['config', '-f', '.gitmodules', '--get', 'submodule.deepseek-harness.path']) !== 'deepseek-harness') {
  fail('the upstream submodule path must be deepseek-harness')
}
if (run('git', ['config', '-f', '.gitmodules', '--get', 'submodule.deepseek-harness.url']) !== upstream.repository) {
  fail('the upstream submodule URL differs from upstream.json')
}
if (typeof upstreamPackage.packageManager !== 'string' || !upstreamPackage.packageManager.startsWith('pnpm@')) {
  fail('the upstream checkout must retain its pnpm package manager')
}

for (const [owner, manifest] of [
  ['root', workspace],
  ['beta desktop', betaPlugin],
  ['next desktop', nextDesktop],
  ['fabric', fabric],
  ['market', market],
]) {
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies', 'resolutions']) {
    for (const [name, range] of Object.entries(manifest[field] ?? {})) {
      if (typeof range !== 'string') continue
      if (/^(?:workspace|portal|link):/u.test(range)
        || (range.startsWith('file:') && range.includes('deepseek-harness'))) {
        fail(`${owner} ${field}.${name} bypasses the published DSH package boundary`)
      }
    }
  }
}

const [mode, object] = run('git', ['ls-files', '--stage', '--', 'deepseek-harness']).split(/\s+/u)
if (mode !== '160000') fail('deepseek-harness must be tracked as a Git submodule')
if (object !== activeUpstream.commit) fail(`submodule index is ${object}, expected ${activeUpstream.commit}`)

const upstreamDir = resolve(root, 'deepseek-harness')
if (run('git', ['rev-parse', 'HEAD'], upstreamDir) !== activeUpstream.commit) {
  fail('checked-out upstream commit differs from upstream.json')
}
if (run('git', ['status', '--porcelain'], upstreamDir) !== '') {
  fail('deepseek-harness contains local changes')
}
if (run('git', ['remote', 'get-url', 'origin'], upstreamDir) !== upstream.repository) {
  fail('deepseek-harness origin differs from upstream.json')
}
if (upstreamPackage.version !== activeUpstream.sourceVersion) {
  fail('deepseek-harness package version differs from upstream.json')
}
// 溯源记录是 Next 外壳「这些文件取自哪个上游提交」的唯一凭据：必须与 pin 逐字段一致，
// 并用上游 checkout 的实际字节复核每条 upstreamSha256。只比版本号、或只检查文件存在，
// 都会让手工改动与上游漂移静默通过。
verifyUpstreamReference({
  reference: nextReference,
  channel: activeUpstream,
  repository: upstream.repository,
  upstreamSha256: path => {
    const candidate = resolve(root, 'deepseek-harness', path)
    return existsSync(candidate) ? createHash('sha256').update(readFileSync(candidate)).digest('hex') : undefined
  },
  localExists: path => existsSync(resolve(root, 'nonead-dsh-desktop', path)),
})
// Every declared upstream channel that still has a Desktop workspace on disk
// must load that channel's recorded DSH runtime family. A channel whose
// workspace was removed keeps its vendored runtime, which
// `corepack yarn check:vendored-runtime` verifies on its own.
for (const [channel, metadata] of Object.entries(upstream.channels ?? {})) {
  if (typeof metadata?.package !== 'string') fail(`upstream metadata for ${channel} does not name a Desktop package`)
  if (!existsSync(resolve(root, metadata.package, 'package.json'))) continue
  const plugin = readJson(`${metadata.package}/package.json`)
  if (plugin.name !== metadata.package) fail(`${channel} upstream metadata points at the wrong package`)
  for (const name of Object.keys(plugin.dependencies ?? {}).filter(name => name === '@deepseek-ai/dsh' || name.startsWith('@deepseek-ai/dsh-'))) {
    if (plugin.dependencies[name] !== metadata.runtimePackageVersion) {
      fail(`${plugin.name} ${name} must use the recorded ${channel} DSH runtime package family`)
    }
  }
}

if (nextDesktop.name !== 'nonead-dsh-desktop' || nextDesktop.private !== true) fail('Next must remain a private experimental package')
for (const [name, version] of Object.entries(nextDesktop.dependencies)) {
  if ((name === '@deepseek-ai/dsh' || name.startsWith('@deepseek-ai/dsh-')) && version !== nextReference.version) fail(`Next ${name} must match the pinned upstream family`)
}

process.stdout.write(`verify-layout: Desktop workspaces including Next and upstream ${activeUpstream.commit.slice(0, 10)} are consistent\n`)
