import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  mentionsVersion,
  normalizeRepository,
  verifyLanguageReleaseParity,
  verifyUpstreamReference,
} from './release-pins.mjs'

const SHA_A = 'a'.repeat(64)
const SHA_B = 'b'.repeat(64)
const CHANNEL = { commit: 'f'.repeat(40), sourceVersion: '0.2.2-alpha.2' }

function reference(overrides = {}) {
  return {
    repository: 'https://github.com/deepseek-ai/deepseek-harness',
    commit: CHANNEL.commit,
    version: CHANNEL.sourceVersion,
    files: [{ upstream: 'apps/desktop/src/host-process.ts', local: 'src/host-process.ts', upstreamSha256: SHA_A }],
    ...overrides,
  }
}

const consistent = {
  channel: CHANNEL,
  repository: 'https://github.com/deepseek-ai/deepseek-harness.git',
  upstreamSha256: path => path === 'apps/desktop/src/host-process.ts' ? SHA_A : undefined,
  localExists: path => path === 'src/host-process.ts',
}

test('接受与 active channel 完全一致的溯源记录（忽略仓库地址的 .git 后缀）', () => {
  assert.deepEqual(verifyUpstreamReference({ ...consistent, reference: reference() }), { fileCount: 1 })
  assert.equal(normalizeRepository('https://github.com/a/b.git/'), normalizeRepository('https://github.com/a/b'))
})

test('拒绝与 pin 不一致的 commit / version / repository', () => {
  assert.throws(() => verifyUpstreamReference({
    ...consistent,
    reference: reference({ commit: 'e'.repeat(40) }),
  }), /differs from the active channel/u)
  assert.throws(() => verifyUpstreamReference({
    ...consistent,
    reference: reference({ commit: 'not-a-sha' }),
  }), /not a full 40-character Git SHA/u)
  assert.throws(() => verifyUpstreamReference({
    ...consistent,
    reference: reference({ version: '0.2.1-rc.2' }),
  }), /differs from the active channel/u)
  assert.throws(() => verifyUpstreamReference({
    ...consistent,
    reference: reference({ repository: 'https://github.com/other/harness' }),
  }), /differs from upstream.json/u)
})

test('拒绝内容漂移：上游文件变更、上游文件缺失、本地副本缺失、哈希格式错误', () => {
  assert.throws(() => verifyUpstreamReference({
    ...consistent,
    reference: reference(),
    upstreamSha256: () => SHA_B,
  }), /no longer matches the recorded upstreamSha256/u)
  assert.throws(() => verifyUpstreamReference({
    ...consistent,
    reference: reference(),
    upstreamSha256: () => undefined,
  }), /missing from the pinned upstream checkout/u)
  assert.throws(() => verifyUpstreamReference({
    ...consistent,
    reference: reference(),
    localExists: () => false,
  }), /missing from the Next shell/u)
  assert.throws(() => verifyUpstreamReference({
    ...consistent,
    reference: reference({
      files: [{ upstream: 'apps/desktop/src/host-process.ts', local: 'src/host-process.ts', upstreamSha256: 'xyz' }],
    }),
  }), /invalid upstreamSha256/u)
})

test('拒绝空记录，并把多条违规合并到一次失败里', () => {
  assert.throws(() => verifyUpstreamReference({ ...consistent, reference: reference({ files: [] }) }), /records no copied file/u)
  assert.throws(() => verifyUpstreamReference({
    ...consistent,
    reference: reference({
      commit: 'e'.repeat(40),
      files: [
        { upstream: 'apps/missing.ts', local: 'src/missing.ts', upstreamSha256: SHA_A },
        { local: 'src/host-process.ts', upstreamSha256: SHA_A },
      ],
    }),
    localExists: () => false,
  }), /differs from the active channel[\s\S]*missing from the pinned upstream checkout[\s\S]*missing from the Next shell[\s\S]*has no upstream path/u)
})

test('CHANGELOG 记录里每个语言都必须以当前发布标题开头', () => {
  const documents = new Map([
    ['CHANGELOG.md', '# 更新日志\n\n## 2.2.3 — 2026-10-29\n\n- 修复\n'],
    ['CHANGELOG.en.md', '# Changelog\n\n## 2.2.3 — 2026-10-29\n\n- Fix\n'],
  ])
  const entries = [...documents.keys()].map(filename => ({ filename, hash: 'a'.repeat(40) }))
  const run = map => verifyLanguageReleaseParity({
    recordPath: 'CHANGELOG.i18n.yaml',
    entries,
    readDocument: filename => {
      const content = map.get(filename)
      if (content === undefined) throw new Error(`missing ${filename}`)
      return content
    },
    version: '2.2.3',
    headings: true,
  })
  assert.deepEqual(run(documents), { documentCount: 2 })
  documents.set('CHANGELOG.en.md', '# Changelog\n\n## 2.2.2 — 2026-10-22\n\n- Fix\n')
  assert.throws(() => run(documents), /CHANGELOG\.en\.md leads with 2\.2\.2, but the released version is 2\.2\.3/u)
  documents.set('CHANGELOG.en.md', '# Changelog without a release heading\n')
  assert.throws(() => run(documents), /must lead with a "## <version> — <date>" release heading/u)
  assert.throws(() => run(new Map([['CHANGELOG.md', '# x\n']])), /cannot read CHANGELOG\.en\.md/u)
})

test('README 记录里每个语言都必须提到当前版本，且不做子串误判', () => {
  const documents = new Map([
    ['README.md', '产品版本 `2.2.3`'],
    ['README.ja.md', '製品バージョン `2.2.3` · runtime `0.2.2-alpha.2`'],
  ])
  const entries = [...documents.keys()].map(filename => ({ filename, hash: 'a'.repeat(40) }))
  const run = map => verifyLanguageReleaseParity({
    recordPath: 'README.i18n.yaml',
    entries,
    readDocument: filename => {
      const content = map.get(filename)
      if (content === undefined) throw new Error(`missing ${filename}`)
      return content
    },
    version: '2.2.3',
  })
  assert.deepEqual(run(documents), { documentCount: 2 })
  documents.set('README.ja.md', '製品バージョン `2.2.2`')
  assert.throws(() => run(documents), /README\.ja\.md does not mention the released version 2\.2\.3/u)
  assert.equal(mentionsVersion('版本 2.2.30', '2.2.3'), false)
  assert.equal(mentionsVersion('版本 2.2.3', '2.2.3'), true)
})
