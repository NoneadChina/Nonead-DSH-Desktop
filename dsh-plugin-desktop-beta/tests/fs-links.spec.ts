import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanupDisposableTree } from '../src/disposable-tree.ts'
import {
  isLinkedPath,
  linkedPathTarget,
  readVerifiedPrivateFile,
  removeLinkedPath,
  sameResolvedPath,
} from '../src/fs-links.ts'

/** Windows needs `junction` here because a directory symlink requires an elevated privilege. */
const directoryLink: 'junction' | 'dir' = process.platform === 'win32' ? 'junction' : 'dir'
const roots: string[] = []

function fixture(): { root: string, target: string, link: string } {
  const root = mkdtempSync(join(tmpdir(), 'dsh-beta-fs-links-'))
  roots.push(root)
  const target = join(root, 'installation')
  const link = join(root, 'projection')
  mkdirSync(join(target, 'lib'), { recursive: true })
  writeFileSync(join(target, 'lib', 'index.js'), 'the installation must survive')
  return { root, target, link }
}

afterEach(() => {
  for (const root of roots.splice(0)) cleanupDisposableTree(root)
})

describe('filesystem link identity', () => {
  it('reports a directory link without flagging anything else', () => {
    const { target, link } = fixture()
    expect(isLinkedPath(target)).toBe(false)
    expect(isLinkedPath(join(target, 'missing'))).toBe(false)
    expect(isLinkedPath(link)).toBe(false)

    symlinkSync(target, link, directoryLink)

    expect(isLinkedPath(link)).toBe(true)
    // The link resolves to its target, while an entry *below* the link is an ordinary path.
    expect(linkedPathTarget(link)).toBe(join(target, 'lib', '..'))
    expect(isLinkedPath(join(link, 'lib'))).toBe(false)
  })

  it('treats two names for the same location as identical', () => {
    const { root, target } = fixture()
    expect(sameResolvedPath(target, join(root, 'installation'))).toBe(true)
    expect(sameResolvedPath(target, join(root, 'elsewhere'))).toBe(false)
    if (process.platform === 'win32') expect(sameResolvedPath(target, target.toUpperCase())).toBe(true)
  })
})

describe('link removal', () => {
  it('removes the link entry and never recurses into its target', () => {
    const { target, link } = fixture()
    symlinkSync(target, link, directoryLink)

    removeLinkedPath(link)

    expect(existsSync(link)).toBe(false)
    expect(existsSync(join(target, 'lib', 'index.js'))).toBe(true)
  })

  it('refuses a path that is not a link', () => {
    const { target } = fixture()
    expect(() => { removeLinkedPath(target) }).toThrow('Refusing to remove a path that is not a link')
    expect(existsSync(join(target, 'lib', 'index.js'))).toBe(true)
  })
})

describe('verified private reads', () => {
  it('returns the content of the validated inode and every rejection reason', () => {
    const { root } = fixture()
    const path = join(root, 'state.json')
    writeFileSync(path, '{"value":1}')
    const info = lstatSync(path)

    const ok = readVerifiedPrivateFile(path, info, 1024)
    expect(ok).toMatchObject({ status: 'ok' })
    expect(ok.status === 'ok' ? ok.bytes.toString('utf8') : undefined).toBe('{"value":1}')
    expect(readVerifiedPrivateFile(join(root, 'absent.json'), info, 1024)).toEqual({ status: 'missing' })
    expect(readVerifiedPrivateFile(path, info, 4)).toEqual({ status: 'size' })
  })

  it('rejects a path whose inode was replaced after validation', () => {
    const { root } = fixture()
    const path = join(root, 'state.json')
    const replacement = join(root, 'replacement.json')
    writeFileSync(path, '{"value":1}')
    const info = lstatSync(path)
    writeFileSync(replacement, '{"value":2}')
    renameSync(replacement, path)

    expect(readVerifiedPrivateFile(path, info, 1024)).toEqual({ status: 'changed' })
  })
})

describe('disposable tree cleanup', () => {
  it('removes a tree that contains a link without emptying the link target', () => {
    const { root, target } = fixture()
    const tree = join(root, 'staging')
    mkdirSync(join(tree, 'cache'), { recursive: true })
    writeFileSync(join(tree, 'cache', 'entry.txt'), 'disposable')
    symlinkSync(target, join(tree, 'cache', 'link'), directoryLink)

    expect(cleanupDisposableTree(tree)).toBe(true)

    expect(existsSync(tree)).toBe(false)
    expect(existsSync(join(target, 'lib', 'index.js'))).toBe(true)
  })

  it('reports a root that is already gone', () => {
    const { root } = fixture()
    expect(cleanupDisposableTree(join(root, 'never-created'))).toBe(false)
  })
})
