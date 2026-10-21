/**
 * Window geometry survives a restart, but a saved position is reused only while it still
 * overlaps a mounted display: an unplugged monitor must not restore the window offscreen.
 */
import { join } from 'node:path'
import { atomicJson, readPrivateFile } from './private-files.ts'

export interface DesktopWindowBounds { x: number; y: number; width: number; height: number }
export interface DesktopWindowState { bounds: DesktopWindowBounds; maximized: boolean }

/** Creation defaults for the primary window when nothing restorable is stored. */
export const DEFAULT_WINDOW_SIZE = Object.freeze({ width: 1280, height: 840 })
/** Same minimums the primary window is created with. */
export const MIN_WINDOW_SIZE = Object.freeze({ width: 800, height: 580 })
/** Part of the window that must sit inside a work area before a saved position is reused. */
const MIN_VISIBLE_SIZE = Object.freeze({ width: 160, height: 80 })
/** `move`/`resize` fire continuously while dragging, so writes are coalesced. */
export const WINDOW_STATE_SAVE_INTERVAL_MS = 500

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** Validate a stored value; corrupt or legacy files fall back to the creation defaults. */
export function parseWindowState(value: unknown): DesktopWindowState | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const bounds = (value as Record<string, unknown>).bounds
  if (!bounds || typeof bounds !== 'object' || Array.isArray(bounds)) return undefined
  const { x, y, width, height } = bounds as Record<string, unknown>
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(width) || !isFiniteNumber(height)) return undefined
  if (width < MIN_WINDOW_SIZE.width || height < MIN_WINDOW_SIZE.height) return undefined
  if (width > 100_000 || height > 100_000 || Math.abs(x) > 1_000_000 || Math.abs(y) > 1_000_000) return undefined
  return {
    bounds: { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) },
    maximized: (value as Record<string, unknown>).maximized === true,
  }
}

export interface DesktopWorkArea { x: number; y: number; width: number; height: number }

/**
 * Resolve a stored geometry against the displays that exist now.
 * @param state - stored bounds and maximized flag, if any.
 * @param workAreas - currently mounted work areas, in Electron's `screen` order.
 * @returns bounds clamped into the best-matching work area, or undefined when the window
 *   would land entirely outside every display (the caller then uses its own defaults).
 */
export function visibleWindowBounds(state: DesktopWindowState | undefined,
  workAreas: readonly DesktopWorkArea[]): DesktopWindowState | undefined {
  if (!state) return undefined
  const { bounds } = state
  let best: DesktopWorkArea | undefined
  let bestOverlap = 0
  for (const area of workAreas) {
    if (!isFiniteNumber(area.x) || !isFiniteNumber(area.y) || !(area.width > 0) || !(area.height > 0)) continue
    const overlapWidth = Math.min(bounds.x + bounds.width, area.x + area.width) - Math.max(bounds.x, area.x)
    const overlapHeight = Math.min(bounds.y + bounds.height, area.y + area.height) - Math.max(bounds.y, area.y)
    if (overlapWidth < MIN_VISIBLE_SIZE.width || overlapHeight < MIN_VISIBLE_SIZE.height) continue
    const overlap = overlapWidth * overlapHeight
    if (overlap > bestOverlap) { bestOverlap = overlap; best = area }
  }
  if (!best) return undefined
  const width = Math.max(MIN_WINDOW_SIZE.width, Math.min(bounds.width, best.width))
  const height = Math.max(MIN_WINDOW_SIZE.height, Math.min(bounds.height, best.height))
  // A restored window keeps its size but is pushed fully inside the work area, so the
  // title bar stays reachable after a resolution or scale-factor change.
  return {
    bounds: {
      x: Math.round(Math.min(Math.max(bounds.x, best.x), best.x + best.width - width)),
      y: Math.round(Math.min(Math.max(bounds.y, best.y), best.y + best.height - height)),
      width: Math.round(width), height: Math.round(height),
    },
    maximized: state.maximized,
  }
}

/** Shell-owned geometry file beside the other userData configuration. */
export class DesktopWindowStateStore {
  readonly file: string
  constructor(home: string) { this.file = join(home, 'window-state.json') }
  read(): DesktopWindowState | undefined {
    const text = readPrivateFile(this.file)
    if (text === undefined) return undefined
    try { return parseWindowState(JSON.parse(text)) } catch { return undefined }
  }
  write(value: DesktopWindowState | undefined): void { if (value) atomicJson(this.file, value) }
}

/** The part of a BrowserWindow geometry tracking needs. */
export interface DesktopWindowLike {
  getNormalBounds(): DesktopWindowBounds
  isMaximized(): boolean
  isMinimized?(): boolean
  isDestroyed?(): boolean
  on(event: 'resize' | 'move' | 'maximize' | 'unmaximize' | 'close', listener: () => void): unknown
  removeListener?(event: 'resize' | 'move' | 'maximize' | 'unmaximize' | 'close', listener: () => void): unknown
}

/**
 * Persist bounds after the last move/resize settles and once more when the window closes.
 * @param window - window to observe.
 * @param save - writes the captured geometry; kept injectable for tests.
 * @param interval - coalescing window for high-frequency events.
 * @returns disposal that stops observing without writing a final value.
 */
export function trackWindowState(window: DesktopWindowLike, save: (state: DesktopWindowState) => void,
  interval = WINDOW_STATE_SAVE_INTERVAL_MS): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  let disposed = false
  const capture = (): void => {
    if (disposed) return
    try {
      if (window.isDestroyed?.() || window.isMinimized?.()) return
      const bounds = window.getNormalBounds()
      if (!isFiniteNumber(bounds.x) || !isFiniteNumber(bounds.y) || !isFiniteNumber(bounds.width) || !isFiniteNumber(bounds.height)) return
      save({
        bounds: { x: Math.round(bounds.x), y: Math.round(bounds.y), width: Math.round(bounds.width), height: Math.round(bounds.height) },
        maximized: window.isMaximized(),
      })
    } catch { /* A closing window can refuse geometry reads; the last saved value stands. */ }
  }
  const flush = (): void => {
    if (timer !== undefined) { clearTimeout(timer); timer = undefined }
    capture()
  }
  const schedule = (): void => {
    if (disposed || timer !== undefined) return
    timer = setTimeout(() => { timer = undefined; capture() }, Math.max(0, interval))
  }
  const events = ['resize', 'move', 'maximize', 'unmaximize'] as const
  for (const event of events) window.on(event, schedule)
  window.on('close', flush)
  return () => {
    disposed = true
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    for (const event of events) window.removeListener?.(event, schedule)
    window.removeListener?.('close', flush)
  }
}
