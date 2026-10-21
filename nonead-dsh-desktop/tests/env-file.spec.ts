import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { parseEnvFile, readEnvFile, withEnvFiles, type EnvLayer } from '../src/env-file.ts'

const directories: string[] = []
function envFile(text: string): string {
  const directory = mkdtempSync(join(tmpdir(), 'next-env-'))
  directories.push(directory)
  const path = join(directory, '.env')
  writeFileSync(path, text)
  return path
}
afterEach(() => { vi.restoreAllMocks(); directories.splice(0).forEach(directory => rmSync(directory, { recursive: true, force: true })) })

it('parses KEY=VALUE lines and skips comments, blank and whitespace-only lines', () => {
  expect(parseEnvFile('# a comment\n\n  \t\nDSH_FOO=1\n#KEY=2\nDSH_BAR=two\n', '.env')).toEqual({ DSH_FOO: '1', DSH_BAR: 'two' })
})

it('accepts spaces around the equals sign and keeps spaces inside the value', () => {
  expect(parseEnvFile('KEY = VALUE\nTRAILING   =   a b  \n', '.env')).toEqual({ KEY: 'VALUE', TRAILING: 'a b' })
})

it('removes one matching pair of quotes and never expands anything', () => {
  const warn = vi.fn()
  expect(parseEnvFile('A="quoted value"\nB=\'single\'\nC=$HOME/bin\nD="unbalanced\n', '.env', warn))
    .toEqual({ A: 'quoted value', B: 'single', C: '$HOME/bin' })
  // The unclosed quote is the only skipped line, and it is reported exactly once.
  expect(warn).toHaveBeenCalledTimes(1)
  expect(warn.mock.calls[0]![0]).toContain('line 4')
  expect(warn.mock.calls[0]![0]).toContain('quotes')
})

it('keeps the first assignment of a duplicated key', () => {
  expect(parseEnvFile('A=first\nA=second\n', '.env')).toEqual({ A: 'first' })
})

it('skips an invalid line with exactly one warning and keeps every valid one', () => {
  const warn = vi.fn()
  expect(parseEnvFile('GOOD=1\nexport BAD=2\nnot an assignment\nGOOD2=ok\n', '.env', warn))
    .toEqual({ GOOD: '1', GOOD2: 'ok' })
  expect(warn).toHaveBeenCalledTimes(2)
  expect(warn.mock.calls[0]![0]).toContain('line 2')
  expect(warn.mock.calls[1]![0]).toContain('line 3')
})

it('never overrides a variable the environment already has and never mutates the base', () => {
  const path = envFile('DSH_SET=from-file\nDSH_MISSING=from-file\n')
  const base = { DSH_SET: 'from-environment' }
  expect(withEnvFiles(base, [{ path, label: 'user .env' }]))
    .toEqual({ DSH_SET: 'from-environment', DSH_MISSING: 'from-file' })
  // The caller's environment is a copy, so the main process keeps what it had.
  expect(base).toEqual({ DSH_SET: 'from-environment' })
})

it('lets the more specific file win and stays silent about a missing file', () => {
  const user = envFile('DSH_ONLY_USER=user\nDSH_BOTH=user\n')
  const repository = envFile('DSH_ONLY_REPOSITORY=repository\nDSH_BOTH=repository\n')
  const warn = vi.fn()
  const layers: EnvLayer[] = [
    { path: user, label: 'user .env' },
    { path: join(tmpdir(), 'next-env-absent', '.env'), label: 'repository .env' },
    { path: repository, label: 'repository .env' },
  ]
  expect(withEnvFiles({}, layers, warn))
    .toEqual({ DSH_ONLY_USER: 'user', DSH_BOTH: 'user', DSH_ONLY_REPOSITORY: 'repository' })
  expect(warn).not.toHaveBeenCalled()
})

it('reports an unreadable file without failing the launch', () => {
  const directory = mkdtempSync(join(tmpdir(), 'next-env-unreadable-'))
  directories.push(directory)
  const warn = vi.fn()
  // A directory where a file is expected cannot be read, so the file contributes nothing.
  expect(readEnvFile(directory, 'user .env', warn)).toEqual({})
  expect(warn).toHaveBeenCalledTimes(1)
  expect(warn.mock.calls[0]![0]).toContain('user .env')
})

it.runIf(process.platform === 'win32')('treats Windows variable names case-insensitively', () => {
  const path = envFile('Path=from-file\n')
  expect(withEnvFiles({ PATH: 'real' }, [{ path, label: 'user .env' }])).toEqual({ PATH: 'real' })
})
