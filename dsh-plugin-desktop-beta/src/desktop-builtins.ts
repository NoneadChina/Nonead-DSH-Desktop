/**
 * 产品内置插件的「用户已移除」状态。
 *
 * ## 为什么需要一份独立状态
 * 内置插件（例如 `dsh-nonead-universal-robots`）由 `cordis.patch.yml` 的 launcher
 * insert 行挂载，**不在 profile manifest 的 bundles 里**，所以既有的 `desktopPlugins`
 * 清单看不到它们；而 `desktopPlugins` 的私有禁用状态只有市场提供方为 `community-market`
 * 时才会被消费（见 `profile.ts`），本产品的用户多半选的是第三方 `dsh-market`。
 * 因此这里维护一份**独立、与市场无关**的状态。
 *
 * ## 为什么不做成 profile 的 npm 依赖
 * 那样市场「已安装」页确实能列出并卸载它，但本包**未发布到任何 registry**且位于
 * `app.asar` 内（pnpm 是外部进程、读不了 asar）。硬写进 `dependencies` 会让用户以后在
 * 市场里装/卸任何插件时 pnpm 解析失败、可能弄坏 profile。故改在产品侧记账。
 *
 * ## 读失败即「未移除」（fail-safe）
 * 文件损坏、权限不足、目录不可信等一律回退到"没有任何插件被移除"，也就是**保持内置插件
 * 正常工作**。宁可让用户再点一次移除，也不能因为一个坏掉的 JSON 就让机器人的 83 个工具
 * 在启动时凭空消失。
 */

import { randomBytes } from 'node:crypto'
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
} from 'node:fs'
import { chmod, lstat, mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { basename, dirname, isAbsolute, join } from 'node:path'
import { type Context, Service } from '@deepseek-ai/cordis'
import { withFileLock, writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'

const BIN_NAME = 'dsh-plugin-desktop-beta'
const STATE_VERSION = 1
const STATE_DIRECTORY_NAME = 'plugin-management'
const STATE_FILENAME = 'builtins.json'
const STATE_DIRECTORY_MODE = 0o700
const STATE_FILE_MODE = 0o600
const MAX_STATE_BYTES = 16 * 1024
const MAX_REMOVED = 64

/** 包名白名单：与 `desktop-plugins.ts` 同一条保守规则。 */
const PACKAGE_NAME_PATTERN = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u

/**
 * 允许用户移除的内置插件。
 *
 * 只收**产品自有、且移除了也不影响桌面自身可启动性**的插件。品牌皮肤
 * （`dsh-nonead-client-skin`）与桌面本体插件都不在列：前者继续由 launcher 强制挂载，
 * 后者是宿主基础设施，去掉会让窗口起不来。
 */
export const REMOVABLE_BUILTIN_PLUGINS: readonly { readonly packageName: string; readonly rowId: string }[] =
  Object.freeze([
    Object.freeze({ packageName: 'dsh-nonead-universal-robots', rowId: 'nonead-universal-robots' }),
  ])

/** 可移除内置插件的包名集合（判定用）。 */
export const REMOVABLE_BUILTIN_NAMES: ReadonlySet<string> = new Set(
  REMOVABLE_BUILTIN_PLUGINS.map(plugin => plugin.packageName),
)

/** 版本化的状态文档。 */
export interface DesktopBuiltinsStateV1 {
  readonly version: 1
  /** 被用户移除、下次生成时不再挂载的内置插件包名（已排序去重）。 */
  readonly removed: readonly string[]
}

/** 严格校验：必须是绝对路径，且位于 `<userData>/plugin-management/` 下。 */
export function assertDesktopBuiltinsStatePath(statePath: string): void {
  if (typeof statePath !== 'string' || !isAbsolute(statePath)
    || statePath.includes('\0')
    || basename(statePath) !== STATE_FILENAME
    || basename(dirname(statePath)) !== STATE_DIRECTORY_NAME) {
    throw new TypeError(
      `${BIN_NAME}: Desktop builtins state path must be <userData>/${STATE_DIRECTORY_NAME}/${STATE_FILENAME}`,
    )
  }
}

/** 由 Electron user-data 目录推出状态文件路径。 */
export function desktopBuiltinsStatePath(userDataDir: string): string {
  if (typeof userDataDir !== 'string' || !isAbsolute(userDataDir)
    || userDataDir.includes('\0') || userDataDir.length === 0) {
    throw new TypeError(`${BIN_NAME}: Desktop builtins user-data directory must be an absolute path without NUL`)
  }
  return join(userDataDir, STATE_DIRECTORY_NAME, STATE_FILENAME)
}

function safePackageName(value: unknown): value is string {
  return typeof value === 'string'
    && value.length <= 214
    && PACKAGE_NAME_PATTERN.test(value)
}

function emptyState(): DesktopBuiltinsStateV1 {
  return { version: STATE_VERSION, removed: [] }
}

/**
 * 解析状态文档。任何不符合预期之处都抛错，由调用方决定降级方式
 * （`readRemovedDesktopBuiltins` 会把它当成"没有移除任何插件"）。
 */
export function parseDesktopBuiltinsState(value: unknown): DesktopBuiltinsStateV1 {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('state root must be an object')
  }
  const root = value as Record<string, unknown>
  const keys = Object.keys(root).sort()
  if (keys.length !== 2 || keys[0] !== 'removed' || keys[1] !== 'version') {
    throw new Error('unexpected fields')
  }
  if (root.version !== STATE_VERSION) throw new Error('unsupported version')
  const removed = root.removed
  if (!Array.isArray(removed) || removed.length > MAX_REMOVED || removed.some(name => !safePackageName(name))) {
    throw new Error('removed must be an array of package names')
  }
  return Object.freeze({
    version: STATE_VERSION,
    removed: Object.freeze([...new Set(removed as string[])].sort()),
  })
}

function readRawState(statePath: string): unknown {
  const directory = dirname(statePath)
  const directoryInfo = lstatSync(directory)
  if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink()) {
    throw new Error('state directory is not private')
  }
  const pathInfo = lstatSync(statePath)
  if (!pathInfo.isFile() || pathInfo.isSymbolicLink()) {
    throw new Error('state must be a regular file')
  }
  if (pathInfo.size > MAX_STATE_BYTES) throw new Error('state is too large')
  const descriptor = openSync(statePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
  try {
    const info = fstatSync(descriptor)
    if (!info.isFile() || info.size > MAX_STATE_BYTES) throw new Error('state must be a small regular file')
    return JSON.parse(readFileSync(descriptor, 'utf8')) as unknown
  } finally {
    closeSync(descriptor)
  }
}

/**
 * 同步读取被移除的内置插件集合。
 *
 * **同步**是刻意的：调用点在启动路径上组装 launcher patch 之前，那里没有 await 的余地。
 * 任何读取/解析失败都回退为空集（= 内置插件照常工作），见文件头「读失败即未移除」。
 *
 * @param statePath `<userData>/plugin-management/builtins.json`
 * @returns 被移除的包名集合；状态不存在或不可读时为空集
 */
export function readRemovedDesktopBuiltins(statePath: string): ReadonlySet<string> {
  try {
    assertDesktopBuiltinsStatePath(statePath)
    return new Set(parseDesktopBuiltinsState(readRawState(statePath)).removed)
  } catch {
    return new Set()
  }
}

/** 目录不存在时创建，并确保它是私有的真实目录。 */
function ensurePrivateStateDirectorySync(statePath: string): void {
  const directory = dirname(statePath)
  try {
    const info = lstatSync(directory)
    if (!info.isDirectory() || info.isSymbolicLink()) {
      throw new Error(`${BIN_NAME}: Desktop builtins state directory must be a real directory`)
    }
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') throw cause
    mkdirSync(directory, { recursive: true, mode: STATE_DIRECTORY_MODE })
  }
}

async function ensurePrivateStateDirectory(statePath: string): Promise<void> {
  const directory = dirname(statePath)
  await mkdir(directory, { recursive: true, mode: STATE_DIRECTORY_MODE })
  const info = await lstat(directory)
  if (!info.isDirectory() || info.isSymbolicLink()) {
    throw new Error(`${BIN_NAME}: Desktop builtins state directory must be a real directory`)
  }
  await chmod(directory, STATE_DIRECTORY_MODE)
}

function renderState(state: DesktopBuiltinsStateV1): string {
  return `${JSON.stringify(state, undefined, 2)}\n`
}

/**
 * 持久化"某个内置插件被移除/被恢复"。
 *
 * 幂等：重复移除或重复恢复都不报错，状态保持正确。
 *
 * @param statePath `<userData>/plugin-management/builtins.json`
 * @param packageName 必须是 {@link REMOVABLE_BUILTIN_NAMES} 里的名字
 * @param removed `true` = 移除（下次生成不再挂载），`false` = 恢复
 */
export async function setDesktopBuiltinRemoved(
  statePath: string,
  packageName: string,
  removed: boolean,
): Promise<void> {
  assertDesktopBuiltinsStatePath(statePath)
  if (!safePackageName(packageName) || !REMOVABLE_BUILTIN_NAMES.has(packageName)) {
    throw new Error(`${BIN_NAME}: ${JSON.stringify(packageName)} is not a removable built-in plugin`)
  }
  // 只为了在写入前把目录准备好；内容本身以锁内的重读为准。
  ensurePrivateStateDirectorySync(statePath)
  await ensurePrivateStateDirectory(statePath)
  await withFileLock(statePath, async () => {
    const current = new Set(readRemovedDesktopBuiltins(statePath))
    if (removed) current.add(packageName)
    else current.delete(packageName)
    const next = parseDesktopBuiltinsState({
      version: STATE_VERSION,
      removed: [...current].sort(),
    })
    const rendered = renderState(next)
    if (Buffer.byteLength(rendered, 'utf8') > MAX_STATE_BYTES) {
      throw new Error(`${BIN_NAME}: Desktop builtins state is too large`)
    }
    await writeFileAtomic(statePath, rendered, {
      mode: STATE_FILE_MODE,
      dirMode: STATE_DIRECTORY_MODE,
    })
  })
}

/**
 * 由既有的插件管理状态路径推出内置插件状态路径。
 *
 * 两者同目录（`<userData>/plugin-management/`），所以从 `plugin-management/state.json`
 * 换成 `builtins.json` 即可，不必给所有调用方再加一个参数。
 *
 * @param pluginStatePath `<userData>/plugin-management/state.json`
 * @returns `<userData>/plugin-management/builtins.json`
 */
export function desktopBuiltinsStatePathFromPluginState(pluginStatePath: string): string {
  return join(dirname(pluginStatePath), STATE_FILENAME)
}

/**
 * 从启动器 patch 文档里摘掉"已被用户移除"的内置插件行。
 *
 * ## 为什么在结构化 patch 上做，而不是在 YAML 里写 `!!js`
 * `loadOverlayPatches()` 已经把 `cordis.patch.yml` 解析成对象数组，所以这里就是一次纯
 * 结构过滤 —— 不必让 `!!js` 表达式去猜 `process.env` 在 Host **子进程**里可不可见。
 *
 * ## 默认路径逐字节不变
 * `removed` 为空（或没有任何条目命中）时**原样返回入参**（同一个数组引用），调用方据此
 * 得到与改动前完全一致的 patch 文档。
 *
 * @param patches 解析后的 patch 文档（`[{ insert: [{ id, name, ... }] }]`）
 * @param removed 被移除的内置插件包名
 * @returns 过滤后的 patch 文档；无变化时就是入参本身
 */
export function omitRemovedBuiltinPatches<T>(
  patches: T[],
  removed: ReadonlySet<string>,
): T[] {
  if (removed.size === 0) return patches
  let changed = false
  const next = patches.map((patch) => {
    if (patch === null || typeof patch !== 'object') return patch
    const record = patch as { insert?: unknown }
    const insert = record.insert
    if (!Array.isArray(insert)) return patch
    const kept = insert.filter((entry) => {
      if (entry === null || typeof entry !== 'object') return true
      const name = (entry as { name?: unknown }).name
      return typeof name !== 'string' || !removed.has(name)
    })
    if (kept.length === insert.length) return patch
    changed = true
    return { ...record, insert: kept } as T
  })
  return changed ? next : patches
}

export const desktopBuiltinsStateConstants = Object.freeze({
  stateVersion: STATE_VERSION,
  stateDirectoryName: STATE_DIRECTORY_NAME,
  stateFilename: STATE_FILENAME,
  stateDirectoryMode: STATE_DIRECTORY_MODE,
  stateFileMode: STATE_FILE_MODE,
  maxStateBytes: MAX_STATE_BYTES,
  maxRemoved: MAX_REMOVED,
  emptyState,
})

/* ------------------------------------------------------------------ *
 * Cordis 服务：把「移除 / 恢复内置插件」暴露给受信的 Host 插件
 * ------------------------------------------------------------------ */

const PREVIEW_TTL_MS = 5 * 60 * 1000
const MAX_PREVIEWS = 256
const PREVIEW_ID_PATTERN = /^(?:remove|restore)_[A-Za-z0-9_-]{43}$/u

/** 一个内置插件在当前安装里的状态。 */
export interface DesktopBuiltinPlugin {
  readonly packageName: string
  /** `cordis.patch.yml` 里那一行的 id（诊断用）。 */
  readonly rowId: string
  /** 从安装目录读到的版本；读不到就是 `null`，绝不猜。 */
  readonly version: string | null
  readonly status: 'active' | 'removed'
}

/** 一次性确认凭据（两阶段，防误触）。 */
export interface DesktopBuiltinPreview {
  readonly previewId: string
  readonly action: 'remove' | 'restore'
  readonly packageName: string
  readonly expiresAt: string
}

/** 稳定的错误码，供受信调用方分支处理。 */
export type DesktopBuiltinsErrorCode =
  | 'invalid-target'
  | 'already-removed'
  | 'already-active'
  | 'preview-expired'
  | 'persistence-failed'

/** 带稳定错误码的错误。 */
export class DesktopBuiltinsError extends Error {
  constructor(readonly code: DesktopBuiltinsErrorCode, message: string) {
    super(message)
    this.name = 'DesktopBuiltinsError'
  }
}

interface BuiltinsPreviewRecord {
  readonly previewId: string
  readonly action: 'remove' | 'restore'
  readonly packageName: string
  readonly expiresAt: number
}

/** 受信 Host 插件可用的内置插件管理能力。 */
export interface DesktopBuiltins {
  /** 列出全部可管理的内置插件及其当前状态。 */
  list(): readonly DesktopBuiltinPlugin[]
  /** 校验目标并签发一个移除确认。 */
  previewRemove(packageName: string): DesktopBuiltinPreview
  /** 消费确认并落盘移除。 */
  executeRemove(previewId: string): Promise<{ packageName: string }>
  /** 校验目标并签发一个恢复确认。 */
  previewRestore(packageName: string): DesktopBuiltinPreview
  /** 消费确认并落盘恢复。 */
  executeRestore(previewId: string): Promise<{ packageName: string }>
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** 产品内置插件的移除/恢复能力。 */
    desktopBuiltins: DesktopBuiltins
  }
}

/**
 * 尽力读取某个内置插件在当前安装里的版本。
 *
 * 走 Node 的解析（Electron 下可读 asar）；任何失败都返回 `null` —— 版本是展示信息，
 * 绝不能因为它读不到就让整份清单失败。
 */
function readBuiltinVersion(installAnchor: string, packageName: string): string | null {
  try {
    const require = createRequire(installAnchor)
    const manifest = require(`${packageName}/package.json`) as { version?: unknown }
    return typeof manifest.version === 'string' && manifest.version !== '' ? manifest.version : null
  } catch {
    return null
  }
}

/** 生成期内的内置插件清单（状态来自磁盘，每次现读，保证与刚刚的移除一致）。 */
export function readDesktopBuiltinInventory(
  statePath: string,
  installAnchor: string,
): readonly DesktopBuiltinPlugin[] {
  const removed = readRemovedDesktopBuiltins(statePath)
  return REMOVABLE_BUILTIN_PLUGINS.map(plugin => ({
    packageName: plugin.packageName,
    rowId: plugin.rowId,
    version: readBuiltinVersion(installAnchor, plugin.packageName),
    status: removed.has(plugin.packageName) ? 'removed' as const : 'active' as const,
  }))
}

/** 两阶段确认的内置插件管理服务。 */
export class DesktopBuiltinsService extends Service implements DesktopBuiltins {
  private readonly now: () => number
  private readonly previews = new Map<string, BuiltinsPreviewRecord>()
  private disposed = false
  private operation: Promise<unknown> | undefined

  constructor(
    ctx: Context,
    private readonly options: {
      readonly statePath: string
      readonly installAnchor: string
      /** 仅测试注入。 */
      readonly now?: () => number
    },
  ) {
    assertDesktopBuiltinsStatePath(options.statePath)
    super(ctx, 'desktopBuiltins')
    this.now = options.now ?? Date.now
    ctx.effect(
      () => () => {
        this.disposed = true
        this.previews.clear()
      },
      'dsh-plugin-desktop-beta: desktop builtins lifetime',
    )
  }

  list(): readonly DesktopBuiltinPlugin[] {
    this.assertActive()
    return readDesktopBuiltinInventory(this.options.statePath, this.options.installAnchor)
  }

  previewRemove(packageName: string): DesktopBuiltinPreview {
    return this.mint('remove', packageName)
  }

  previewRestore(packageName: string): DesktopBuiltinPreview {
    return this.mint('restore', packageName)
  }

  executeRemove(previewId: string): Promise<{ packageName: string }> {
    return this.execute(previewId, 'remove', true)
  }

  executeRestore(previewId: string): Promise<{ packageName: string }> {
    return this.execute(previewId, 'restore', false)
  }

  private mint(action: 'remove' | 'restore', packageName: string): DesktopBuiltinPreview {
    this.assertActive()
    const target = this.list().find(plugin => plugin.packageName === packageName)
    if (target === undefined) {
      throw new DesktopBuiltinsError('invalid-target', '这个内置插件不在可管理清单里。')
    }
    if (action === 'remove' && target.status === 'removed') {
      throw new DesktopBuiltinsError('already-removed', '这个内置插件已经被移除了。')
    }
    if (action === 'restore' && target.status === 'active') {
      throw new DesktopBuiltinsError('already-active', '这个内置插件当前是可用的。')
    }
    this.prunePreviews()
    if (this.previews.size >= MAX_PREVIEWS) {
      const oldest = this.previews.keys().next().value as string | undefined
      if (oldest !== undefined) this.previews.delete(oldest)
    }
    const previewId = `${action}_${randomBytes(32).toString('base64url')}`
    const record: BuiltinsPreviewRecord = {
      previewId,
      action,
      packageName,
      expiresAt: this.now() + PREVIEW_TTL_MS,
    }
    this.previews.set(previewId, record)
    return {
      previewId,
      action,
      packageName,
      expiresAt: new Date(record.expiresAt).toISOString(),
    }
  }

  private execute(
    previewId: string,
    action: 'remove' | 'restore',
    removed: boolean,
  ): Promise<{ packageName: string }> {
    try {
      this.assertActive()
      if (!PREVIEW_ID_PATTERN.test(previewId)) return Promise.reject(this.expiredPreview())
      if (this.operation !== undefined) {
        return Promise.reject(new DesktopBuiltinsError(
          'persistence-failed',
          '另一个内置插件变更正在进行。',
        ))
      }
      const preview = this.previews.get(previewId)
      this.previews.delete(previewId)
      if (preview === undefined || preview.expiresAt <= this.now() || preview.action !== action) {
        return Promise.reject(this.expiredPreview())
      }
      const operation = this.persist(preview.packageName, removed)
      this.operation = operation
      void operation.then(
        () => { if (this.operation === operation) this.operation = undefined },
        () => { if (this.operation === operation) this.operation = undefined },
      )
      return operation
    } catch (cause) {
      return Promise.reject(cause)
    }
  }

  private async persist(packageName: string, removed: boolean): Promise<{ packageName: string }> {
    try {
      // 消费确认时**重新校验一次目标**：确认签发到落盘之间用户可能已经改过状态。
      const current = this.list().find(plugin => plugin.packageName === packageName)
      if (current === undefined) {
        throw new DesktopBuiltinsError('invalid-target', '这个内置插件不在可管理清单里。')
      }
      if (removed && current.status === 'removed') {
        throw new DesktopBuiltinsError('already-removed', '这个内置插件已经被移除了。')
      }
      if (!removed && current.status === 'active') {
        throw new DesktopBuiltinsError('already-active', '这个内置插件当前是可用的。')
      }
      await setDesktopBuiltinRemoved(this.options.statePath, packageName, removed)
      return { packageName }
    } catch (cause) {
      if (cause instanceof DesktopBuiltinsError) throw cause
      throw new DesktopBuiltinsError('persistence-failed', '无法保存内置插件变更。')
    }
  }

  private prunePreviews(): void {
    const now = this.now()
    for (const [id, preview] of this.previews) {
      if (preview.expiresAt <= now) this.previews.delete(id)
    }
  }

  private expiredPreview(): DesktopBuiltinsError {
    return new DesktopBuiltinsError('preview-expired', '这次确认已过期或已被使用。')
  }

  private assertActive(): void {
    if (this.disposed) throw new Error(`${BIN_NAME}: desktopBuiltins service disposed`)
  }
}

export default DesktopBuiltinsService
