import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import {
  DEFAULT_WINDOW_SIZE, DesktopWindowStateStore, MIN_WINDOW_SIZE, parseWindowState, trackWindowState,
  visibleWindowBounds, WINDOW_STATE_SAVE_INTERVAL_MS, type DesktopWindowState,
} from '../src/window-state.ts'

const homes: string[] = []
function home(): string {
  const path = mkdtempSync(join(tmpdir(), 'next-window-state-'))
  homes.push(path)
  return path
}
afterEach(() => { for (const path of homes.splice(0)) rmSync(path, { recursive: true, force: true }) })

function stored(bounds = { x: 100, y: 100, width: 1280, height: 840 }, maximized = false): DesktopWindowState {
  return { bounds, maximized }
}

function trackedWindow(bounds = { x: 100, y: 100, width: 1280, height: 840 }) {
  const listeners = new Map<string, Set<() => void>>()
  const state = { bounds: { ...bounds }, maximized: false }
  return {
    state,
    on(event: string, listener: () => void) {
      const set = listeners.get(event) ?? new Set<() => void>()
      set.add(listener); listeners.set(event, set)
      return this
    },
    removeListener(event: string, listener: () => void) { listeners.get(event)?.delete(listener); return this },
    emit(event: string) { for (const listener of listeners.get(event) ?? []) listener() },
    listenerCount(event: string) { return listeners.get(event)?.size ?? 0 },
    getNormalBounds: () => ({ ...state.bounds }),
    isMaximized: () => state.maximized,
    isMinimized: () => false,
    isDestroyed: () => false,
  }
}

it('keeps the creation defaults and minimums aligned with the primary window', () => {
  expect(DEFAULT_WINDOW_SIZE).toEqual({ width: 1280, height: 840 })
  expect(MIN_WINDOW_SIZE).toEqual({ width: 800, height: 580 })
})

it('rejects corrupt or undersized stored geometry instead of restoring it', () => {
  expect(parseWindowState(undefined)).toBeUndefined()
  expect(parseWindowState('{"bounds":{}}')).toBeUndefined()
  expect(parseWindowState({ bounds: { x: 0, y: 0, width: 700, height: 500 } })).toBeUndefined()
  expect(parseWindowState({ bounds: { x: 0, y: 0, width: Number.NaN, height: 900 } })).toBeUndefined()
  expect(parseWindowState({ bounds: { x: 0, y: 0, width: 100_001, height: 900 } })).toBeUndefined()
  expect(parseWindowState({ bounds: { x: '0', y: 0, width: 1280, height: 900 } })).toBeUndefined()
  expect(parseWindowState({ bounds: { x: 10.4, y: 20.6, width: 1280, height: 840 }, maximized: true }))
    .toEqual({ bounds: { x: 10, y: 21, width: 1280, height: 840 }, maximized: true })
  // A legacy file without the maximized flag restores the geometry but not the state.
  expect(parseWindowState({ bounds: { x: 0, y: 0, width: 1280, height: 840 } })?.maximized).toBe(false)
})

it('restores stored bounds while a display still shows them', () => {
  const value = stored({ x: 200, y: 120, width: 1100, height: 700 }, true)
  expect(visibleWindowBounds(value, [{ x: 0, y: 0, width: 2560, height: 1440 }])).toEqual(value)
})

it('falls back to the defaults when the saved display is gone', () => {
  const value = stored({ x: 3000, y: 200, width: 1280, height: 840 }, true)
  expect(visibleWindowBounds(value, [{ x: 0, y: 0, width: 1920, height: 1080 }])).toBeUndefined()
  expect(visibleWindowBounds(value, [])).toBeUndefined()
  expect(visibleWindowBounds(undefined, [{ x: 0, y: 0, width: 1920, height: 1080 }])).toBeUndefined()
})

it('pushes a partially visible window inside the work area and keeps the title bar reachable', () => {
  const clamped = visibleWindowBounds(stored({ x: -300, y: -200, width: 1280, height: 840 }),
    [{ x: 0, y: 0, width: 1920, height: 1080 }])
  expect(clamped?.bounds).toEqual({ x: 0, y: 0, width: 1280, height: 840 })
  // A window larger than the display shrinks to it instead of hanging off the edge.
  const shrunk = visibleWindowBounds(stored({ x: 0, y: 0, width: 2560, height: 1600 }),
    [{ x: 0, y: 0, width: 1920, height: 1080 }])
  expect(shrunk?.bounds).toEqual({ x: 0, y: 0, width: 1920, height: 1080 })
})

it('round-trips the state file and ignores a corrupt one', () => {
  const root = home()
  const store = new DesktopWindowStateStore(root)
  expect(store.file).toBe(join(root, 'window-state.json'))
  expect(store.read()).toBeUndefined()
  store.write(stored({ x: 40, y: 60, width: 1000, height: 700 }, true))
  expect(store.read()).toEqual(stored({ x: 40, y: 60, width: 1000, height: 700 }, true))
  writeFileSync(store.file, '{not json')
  expect(store.read()).toBeUndefined()
  expect(() => store.write(undefined)).not.toThrow()
})

it('coalesces drag events and writes once more when the window closes', () => {
  vi.useFakeTimers()
  try {
    const saves: DesktopWindowState[] = []
    const window = trackedWindow()
    const stop = trackWindowState(window, value => saves.push(value))
    window.state.bounds.x = 40
    window.emit('move')
    window.state.bounds.y = 60
    window.emit('resize')
    expect(saves).toHaveLength(0)
    vi.advanceTimersByTime(WINDOW_STATE_SAVE_INTERVAL_MS - 1)
    expect(saves).toHaveLength(0)
    vi.advanceTimersByTime(1)
    expect(saves).toHaveLength(1)
    expect(saves[0]).toEqual({ bounds: { x: 40, y: 60, width: 1280, height: 840 }, maximized: false })
    window.state.maximized = true
    window.emit('maximize')
    vi.advanceTimersByTime(WINDOW_STATE_SAVE_INTERVAL_MS)
    expect(saves.at(-1)?.maximized).toBe(true)
    // Closing flushes the pending value immediately, without waiting for the timer.
    window.state.bounds.x = 12
    window.emit('close')
    expect(saves.at(-1)?.bounds.x).toBe(12)
    stop()
    expect(window.listenerCount('move')).toBe(0)
    expect(window.listenerCount('close')).toBe(0)
    const count = saves.length
    window.emit('move')
    vi.advanceTimersByTime(WINDOW_STATE_SAVE_INTERVAL_MS * 2)
    expect(saves).toHaveLength(count)
  } finally { vi.useRealTimers() }
})
