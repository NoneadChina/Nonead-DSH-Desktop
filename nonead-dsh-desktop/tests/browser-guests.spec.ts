/** Releasing a Sidebar browser lease must be bounded even when a guest never reports destruction. */
import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { isPackaged: false },
  session: { fromPartition: () => ({
    setPermissionRequestHandler() {}, setPermissionCheckHandler() {}, setDevicePermissionHandler() {},
    setDisplayMediaRequestHandler() {}, on() {}, webRequest: { onBeforeRequest() {} },
  }) },
}))
import { DesktopBrowserGuests } from '../src/browser-guests.ts'

/** One guest WebContents: `destroyed` is emitted only when the test says so. */
class FakeGuest extends EventEmitter {
  destroyed = false
  closes = 0
  crashes = 0
  constructor(private readonly lease: string) { super() }
  getURL(): string { return `about:blank#${this.lease}` }
  isDestroyed(): boolean { return this.destroyed }
  close(_options?: unknown): void { this.closes += 1 }
  forcefullyCrashRenderer(): void { this.crashes += 1 }
  setWindowOpenHandler(): void {}
  setIgnoreMenuShortcuts(): void {}
  focus(): void {}
  send(): void {}
  emitDestroyed(): void { this.destroyed = true; this.emit('destroyed') }
}

const owner = () => Object.assign(new EventEmitter(), { id: 1, isDestroyed: () => false, send: vi.fn() })
const bindWindow = (contents: EventEmitter) => ({ webContents: contents }) as never

/** Reserve one lease, attach a guest to it and hand the guest back. */
function attachedGuest(guests: DesktopBrowserGuests, window: ReturnType<typeof owner>, close: 'close' | 'ignore'): FakeGuest {
  const reservation = guests.acquire(window as never, 'workspace-one')
  guests.bind(bindWindow(window), () => () => {})
  const guest = new FakeGuest(reservation.lease)
  if (close === 'close') guest.close = function close(): void { this.closes += 1; queueMicrotask(() => this.emitDestroyed()) }
  window.emit('did-attach-webview', {}, guest)
  guest.emit('dom-ready')
  return guest
}

beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}) })
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

it('releases a guest that closes normally without destroying it', async () => {
  const guests = new DesktopBrowserGuests(() => [])
  const window = owner()
  const guest = attachedGuest(guests, window, 'close')
  await guests.release(window as never, (guest.getURL()).slice('about:blank#'.length))
  expect(guest.closes).toBe(1)
  expect(guest.crashes).toBe(0)
  expect(console.error).not.toHaveBeenCalled()
  // The lease is gone, so a repeated release settles immediately instead of finding the guest again.
  await guests.release(window as never, (guest.getURL()).slice('about:blank#'.length))
  expect(guest.closes).toBe(1)
})

it('crashes the renderer after the close deadline and reports the escalation', async () => {
  const guests = new DesktopBrowserGuests(() => [])
  const window = owner()
  const guest = attachedGuest(guests, window, 'ignore')
  // A crash retires the guest immediately here, so only the close deadline elapses before it settles.
  guest.forcefullyCrashRenderer = function forcefullyCrashRenderer(): void { this.crashes += 1; queueMicrotask(() => this.emitDestroyed()) }
  vi.useFakeTimers()
  let settled = false
  const pending = guests.release(window as never, (guest.getURL()).slice('about:blank#'.length)).then(() => { settled = true })
  await vi.advanceTimersByTimeAsync(1_499)
  expect(settled).toBe(false)
  expect(guest.crashes).toBe(0)
  await vi.advanceTimersByTimeAsync(1)
  await pending
  expect(settled).toBe(true)
  expect(guest.crashes).toBe(1)
  expect(console.error).toHaveBeenCalledWith(expect.objectContaining({
    message: expect.stringContaining('guest did not close within 1500 ms'),
  }))
})

it('releases the lease even when the guest never reports destruction at all', async () => {
  const guests = new DesktopBrowserGuests(() => [])
  const window = owner()
  const guest = attachedGuest(guests, window, 'ignore')
  vi.useFakeTimers()
  let settled = false
  const pending = guests.release(window as never, (guest.getURL()).slice('about:blank#'.length)).then(() => { settled = true })
  await vi.advanceTimersByTimeAsync(2_000)
  await pending
  expect(settled).toBe(true)
  expect(guest.crashes).toBe(1)
  expect(console.error).toHaveBeenCalledWith(expect.objectContaining({
    message: expect.stringContaining('did not report destruction within 2000 ms'),
  }))
})
