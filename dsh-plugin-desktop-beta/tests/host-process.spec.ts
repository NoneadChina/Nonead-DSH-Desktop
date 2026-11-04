import { EventEmitter } from 'node:events'
import { expect, it, vi } from 'vitest'
import { createLaunchEnvironmentSnapshot } from '@deepseek-ai/dsh-launch-environment'
import type { DesktopStartupGenerationHost } from '../src/startup-generation.ts'
const state = vi.hoisted(() => ({ fork: vi.fn() }))
vi.mock('electron', () => ({ utilityProcess: { fork: state.fork } }))
import {
  formatUnexpectedHostExit, HOST_STDERR_TAIL_CHARS, startIsolatedDesktopHost,
  type IsolatedHostExit, type IsolatedHostOptions,
} from '../src/host-process.ts'

function fixture() {
  const child = Object.assign(new EventEmitter(), {
    stdout: new EventEmitter(), stderr: new EventEmitter(),
    postMessage: vi.fn((message: { kind: string; id: number; method?: string }) => {
      if (message.kind === 'call') queueMicrotask(() => child.emit('message', { kind: 'result', id: message.id, value: { pid: 123 } }))
    }),
    kill: vi.fn(() => { queueMicrotask(() => child.emit('exit', 0)); return true }),
  })
  state.fork.mockReturnValue(child)
  let host!: DesktopStartupGenerationHost
  const onFailure = vi.fn()
  const options = {
    host: { desktopLaunchEnvironment: createLaunchEnvironmentSnapshot([]) },
    runtime: { platform: 'win32', locale: 'en', updates: { currentVersion: '2.0.7-beta.1' } },
    rendererToken: 'fixture', prepareCertificate: async () => ({ failureCode: 'fixture' }),
    bindHost: (value: DesktopStartupGenerationHost) => { host = value }, requestQuit() {}, onFailure,
  } as unknown as IsolatedHostOptions
  return { child, options, onFailure, host: () => host }
}
it('binds the child before startup and makes repeated teardown idempotent', async () => {
  const f = fixture()
  await startIsolatedDesktopHost(f.options)
  await Promise.all([f.host().fiber.dispose(), f.host().fiber.dispose()])
  expect(f.child.kill).toHaveBeenCalledOnce()
  expect(f.onFailure).not.toHaveBeenCalled()
  expect(f.child.postMessage.mock.calls.filter(([m]) => m.method === 'stop')).toHaveLength(1)
})
it('reports unexpected Host exit without automatically relaunching or replaying work', async () => {
  const f = fixture()
  await startIsolatedDesktopHost(f.options)
  f.child.emit('exit', 9)
  expect(f.onFailure).toHaveBeenCalledOnce()
  await f.host().fiber.dispose()
  expect(f.child.kill).not.toHaveBeenCalled()
})
it('carries the exit code and how long the Host lived, so a code 0 is not read as a clean exit', async () => {
  const f = fixture()
  await startIsolatedDesktopHost(f.options)
  f.child.emit('exit', 0)
  const [error, exit] = f.onFailure.mock.calls[0] as [Error, { exitCode: number; uptimeMs: number }]
  expect(error.message).toContain('DSH Host exited (0)')
  expect(exit.exitCode).toBe(0)
  expect(exit.uptimeMs).toBeGreaterThanOrEqual(0)
  expect(Number.isFinite(exit.uptimeMs)).toBe(true)
})
it('leaves a Desktop-requested teardown off the unexpected-exit record', async () => {
  const f = fixture()
  await startIsolatedDesktopHost(f.options)
  await f.host().fiber.dispose()
  expect(f.onFailure).not.toHaveBeenCalled()
})
it('keeps what a fatal Host said last, since its stderr is otherwise never persisted', async () => {
  const f = fixture()
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  try {
    await startIsolatedDesktopHost(f.options)
    f.child.stderr.emit('data', Buffer.from('x'.repeat(HOST_STDERR_TAIL_CHARS)))
    // A multibyte character split across two chunks must not turn into replacement characters.
    const euro = Buffer.from('€')
    f.child.stderr.emit('data', Buffer.concat([Buffer.from('dsh: fatal load failure: boom '), euro.subarray(0, 1)]))
    f.child.stderr.emit('data', euro.subarray(1))
    f.child.emit('exit', 1)
  } finally { vi.restoreAllMocks() }
  const [error, exit] = f.onFailure.mock.calls[0] as [Error, IsolatedHostExit]
  expect(exit.stderrTail).toHaveLength(HOST_STDERR_TAIL_CHARS)
  expect(exit.stderrTail.endsWith('dsh: fatal load failure: boom €')).toBe(true)
  expect(formatUnexpectedHostExit(error, exit))
    .toBe(`DSH Host exited (1); restart the application to reconnect\nLast DSH Host stderr:\n${exit.stderrTail}`)
})
it('logs only the exit reason when the Host wrote nothing', () => {
  const error = new Error('DSH Host exited (0); restart the application to reconnect')
  expect(formatUnexpectedHostExit(error, { exitCode: 0, uptimeMs: 1, stderrTail: '\n' })).toBe(error.message)
})

it('still releases the native bindings and the child listener when the Host exit is never confirmed', async () => {
  vi.useFakeTimers()
  const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  try {
    const f = fixture()
    f.child.kill.mockImplementation(() => true)
    await startIsolatedDesktopHost(f.options)
    expect(f.child.listenerCount('message')).toBe(1)

    const disposing = f.host().fiber.dispose()
    const rejected = expect(disposing).rejects.toThrow('termination was not confirmed')
    await vi.advanceTimersByTimeAsync(1_100)
    await rejected

    expect(f.child.listenerCount('message')).toBe(0)
  } finally {
    stderr.mockRestore()
    vi.useRealTimers()
  }
})

it('keeps the boot failure as the reported cause when teardown cannot confirm the Host exit', async () => {
  vi.useFakeTimers()
  const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  try {
    const f = fixture()
    f.child.postMessage.mockImplementation((message: { kind: string; id: number; method?: string }) => {
      if (message.kind !== 'call') return
      queueMicrotask(() => f.child.emit('message', message.method === 'boot'
        ? { kind: 'result', id: message.id, error: 'boot exploded' }
        : { kind: 'result', id: message.id, value: { pid: 123 } }))
    })
    f.child.kill.mockImplementation(() => true)

    const starting = startIsolatedDesktopHost(f.options)
    const rejected = expect(starting).rejects.toThrow('boot exploded')
    await vi.advanceTimersByTimeAsync(1_500)
    await rejected
  } finally {
    stderr.mockRestore()
    vi.useRealTimers()
  }
})
