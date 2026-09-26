/** Durable bounds for the one Nonead DSH Desktop main window. */

import { randomUUID } from 'node:crypto'
import {
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join } from 'node:path'

const STATE_VERSION = 1
const MAX_STATE_BYTES = 4 * 1024
const STATE_DIRECTORY_MODE = 0o700
const STATE_FILE_MODE = 0o600
/**
 * Windows can refuse a rename onto a path another process momentarily holds
 * (indexer, anti-virus, a viewer). Those failures are transient, so a bounded
 * retry keeps the window geometry instead of silently dropping it.
 */
const ATOMIC_REPLACE_RETRY_COUNT = 5
const ATOMIC_REPLACE_RETRY_DELAY_MS = 20

/** Sleep synchronously; this store writes from a synchronous event handler. */
function sleepSync(milliseconds: number): void {
  const shared = new Int32Array(new SharedArrayBuffer(4))
  Atomics.wait(shared, 0, 0, milliseconds)
}

/**
 * Injection seam for the atomic-replace retry loop.
 *
 * Module mocking of `node:fs` cannot reach a synchronous rename on the store's
 * hot path without disturbing every other filesystem call, so the loop consults
 * this hook instead: return an error to refuse the attempt, or `undefined` to let
 * the real rename proceed. Production never installs a hook.
 */
let renameAttemptFailure: (() => Error | undefined) | undefined

/** Install or clear the atomic-replace failure hook used by focused tests. */
export function setRenameAttemptFailure(hook: (() => Error | undefined) | undefined): void {
  renameAttemptFailure = hook
}

/** Replace a destination with a fully written temporary file, retrying a transient refusal. */
function replaceFileWithRetry(temporary: string, destination: string): void {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const injected = renameAttemptFailure?.()
      if (injected !== undefined) throw injected
      renameSync(temporary, destination)
      return
    } catch (cause) {
      const code = (cause as NodeJS.ErrnoException).code
      const transient = code === 'EPERM' || code === 'EBUSY' || code === 'EACCES'
      if (!transient || attempt >= ATOMIC_REPLACE_RETRY_COUNT) throw cause
      sleepSync(ATOMIC_REPLACE_RETRY_DELAY_MS * (attempt + 1))
    }
  }
}

export const MAIN_WINDOW_STATE_FILENAME = 'main-window-state.json'

/** Electron-compatible main-window rectangle, kept independent from Electron at runtime. */
export interface MainWindowBounds {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

interface MainWindowStateV1 {
  readonly version: 1
  readonly bounds: MainWindowBounds
}

/** Minimal persistence seam used by the native shell generation. */
export interface MainWindowStateStore {
  read(): MainWindowBounds | undefined
  write(bounds: MainWindowBounds): void
}

function isSafeCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value)
}

function isPositiveDimension(value: unknown): value is number {
  return isSafeCoordinate(value) && value > 0
}

function parseBounds(value: unknown): MainWindowBounds {
  if (value === null || typeof value !== 'object') {
    throw new Error('main-window bounds must be an object')
  }
  const candidate = value as Partial<Record<keyof MainWindowBounds, unknown>>
  if (!isSafeCoordinate(candidate.x) || !isSafeCoordinate(candidate.y)) {
    throw new Error('main-window coordinates must be safe integers')
  }
  if (!isPositiveDimension(candidate.width) || !isPositiveDimension(candidate.height)) {
    throw new Error('main-window dimensions must be positive safe integers')
  }
  return {
    x: candidate.x,
    y: candidate.y,
    width: candidate.width,
    height: candidate.height,
  }
}

function unlinkTemporary(path: string): void {
  try {
    unlinkSync(path)
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') throw cause
  }
}

/** Filesystem-backed state store under Electron's user-data directory. */
export class FileMainWindowStateStore implements MainWindowStateStore {
  readonly statePath: string

  constructor(userDataDirectory: string) {
    this.statePath = join(userDataDirectory, MAIN_WINDOW_STATE_FILENAME)
  }

  read(): MainWindowBounds | undefined {
    let info
    try {
      info = lstatSync(this.statePath)
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return undefined
      throw cause
    }
    if (!info.isFile() || info.isSymbolicLink()) {
      throw new Error('main-window state must be a regular file')
    }
    if (info.size > MAX_STATE_BYTES) {
      throw new Error(`main-window state exceeds ${String(MAX_STATE_BYTES)} bytes`)
    }
    const parsed: unknown = JSON.parse(readFileSync(this.statePath, 'utf8'))
    if (parsed === null || typeof parsed !== 'object' || (parsed as { version?: unknown }).version !== STATE_VERSION) {
      throw new Error('main-window state has an unsupported version')
    }
    return parseBounds((parsed as { bounds?: unknown }).bounds)
  }

  write(bounds: MainWindowBounds): void {
    const validated = parseBounds(bounds)
    const directory = dirname(this.statePath)
    mkdirSync(directory, { recursive: true, mode: STATE_DIRECTORY_MODE })
    const directoryInfo = lstatSync(directory)
    if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink()) {
      throw new Error('main-window state directory must be a real directory')
    }
    const state: MainWindowStateV1 = { version: STATE_VERSION, bounds: validated }
    const temporary = join(directory, `.${basename(this.statePath)}.${process.pid}.${randomUUID()}.tmp`)
    try {
      writeFileSync(temporary, `${JSON.stringify(state, undefined, 2)}\n`, {
        encoding: 'utf8',
        flag: 'wx',
        mode: STATE_FILE_MODE,
      })
      replaceFileWithRetry(temporary, this.statePath)
    } finally {
      unlinkTemporary(temporary)
    }
  }
}

/** Keep a restored rectangle usable when monitor layout or work area has changed. */
export function fitMainWindowBounds(
  bounds: MainWindowBounds,
  workArea: MainWindowBounds,
  minimum: Pick<MainWindowBounds, 'width' | 'height'>,
): MainWindowBounds {
  const restored = parseBounds(bounds)
  const available = parseBounds(workArea)
  const minWidth = isPositiveDimension(minimum.width) ? minimum.width : 1
  const minHeight = isPositiveDimension(minimum.height) ? minimum.height : 1
  const width = Math.max(minWidth, Math.min(restored.width, available.width))
  const height = Math.max(minHeight, Math.min(restored.height, available.height))
  const visibleWidth = Math.max(
    0,
    Math.min(restored.x + width, available.x + available.width) - Math.max(restored.x, available.x),
  )
  const topEdgeIsReachable = restored.y >= available.y - 32
    && restored.y < available.y + available.height - 36
  if (width === restored.width
    && height === restored.height
    && visibleWidth >= Math.min(64, width)
    && topEdgeIsReachable) {
    return restored
  }
  const maxX = available.x + Math.max(0, available.width - width)
  const maxY = available.y + Math.max(0, available.height - height)
  return {
    x: Math.min(maxX, Math.max(available.x, restored.x)),
    y: Math.min(maxY, Math.max(available.y, restored.y)),
    width,
    height,
  }
}

/** Compare two window rectangles without relying on object identity. */
export function sameMainWindowBounds(left: MainWindowBounds, right: MainWindowBounds): boolean {
  return left.x === right.x
    && left.y === right.y
    && left.width === right.width
    && left.height === right.height
}
