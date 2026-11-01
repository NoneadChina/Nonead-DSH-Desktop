import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

// The classifier is a stdin filter in CI (`git diff --name-only -z | node
// scripts/classify-ci-changes.mjs`), so the tests drive that exact interface: a
// documentation-only change skips the product gates, a product change must not.
const scriptPath = fileURLToPath(new URL('./classify-ci-changes.mjs', import.meta.url))

function classify(paths, separator = '\0') {
  const result = spawnSync(process.execPath, [scriptPath], {
    input: paths.join(separator),
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim()
}

test('documentation formats are documentation wherever they live', () => {
  for (const path of [
    'README.md',
    'CHANGELOG.en.md',
    'docs/user-guide.md',
    'docs/faq.mdx',
    'docs/faq.i18n.yaml',
    'nested/docs/page.md',
  ]) {
    assert.equal(classify([path]), 'false', `${path} must not require the product gates`)
  }
})

test('non-document files under docs/ require the product gates', () => {
  for (const path of [
    'docs/foo.js',
    'docs/foo.mjs',
    'docs/foo.cjs',
    'docs/foo.ts',
    'docs/foo.json',
    'docs/foo.yaml',
  ]) {
    assert.equal(classify([path]), 'true', `${path} must require the product gates`)
  }
})

test('documentation images and issue templates stay documentation', () => {
  for (const path of [
    'docs/evidence/assets/screenshot.png',
    'docs/diagram.svg',
    '.github/ISSUE_TEMPLATE/bug.yml',
  ]) {
    assert.equal(classify([path]), 'false', `${path} must not require the product gates`)
  }
})

test('product images keep the product gates', () => {
  assert.equal(classify(['build/app-icon.png']), 'true')
  assert.equal(classify(['nonead-dsh-desktop/build/app-icon-mac.png']), 'true')
})

test('runtime JSON Schemas under docs/ require the product gates', () => {
  assert.equal(classify(['docs/schemas/catalog.schema.json']), 'true')
})

test('source changes require the product gates', () => {
  assert.equal(classify(['src/a.ts']), 'true')
  assert.equal(classify(['docs/foo.js', 'README.md']), 'true')
})

test('product-critical documents require the product gates', () => {
  assert.equal(classify(['LICENSE']), 'true')
  assert.equal(classify(['vendor/x/THIRD_PARTY_NOTICES.md']), 'true')
})

test('newline and CRLF input classify the same paths', () => {
  assert.equal(classify(['README.md', 'docs/foo.md'], '\n'), 'false')
  assert.equal(classify(['README.md', 'docs/foo.js'], '\n'), 'true')
  assert.equal(classify(['README.md', 'docs/foo.js'], '\r\n'), 'true')
})

test('an empty change list keeps the product gates', () => {
  assert.equal(classify([]), 'true')
})
