/**
 * src/client/index.js — 客户端半的装配入口（Task 9）。
 *
 * 装配顺序（**唯一** `state`，全客户端只此一条轮询链）：
 *   1. `createTwinState({ ip })` → `start()`（Task 6：轮询 host 只读状态路由 + 失败退避）
 *   2. `mountSidebarEntry(...)`（Task 9）：注入侧边栏入口行（自愈 + 激活事件协议），
 *      并**按需**在中栏挂载大视图；它同时负责把缩略图插槽插在入口行之后（与入口同生共死）
 *   3. `mountThumbnail({ container: 插槽, state })`（Task 9）：内嵌缩略 3D，**复用同一个 state**
 *   4. 大视图 `mountTwinPanel`（Task 8）由入口在**点击展开时**才挂载，收起时 dispose —— 不做无谓的 WebGL 初始化
 *
 * `apply(ctx)` 返回清理函数：dispose 所有挂载 + `state.stop()`（`ctx.effect` 语义）。
 * 调试标记 `globalThis.__UR_TWIN__` 在 Task 1 就已约定并保留（`loaded`/`at` 字段不许改），
 * 这里额外挂上 `ip` / `state` / 各挂载句柄，便于 GUI 侧排查。
 *
 * IP 来源（Ruling 35）：**默认不指定**，由 host 依据其连接注册表解析到"当前已连接的那一个机器人"
 * —— 浏览器半不该猜机器人地址（曾默认 `192.168.1.199`，与真实机器人 `192.168.2.201` 不符，
 * 会导致数字孪生永远显示"未连接"）。仅在需要覆盖时才提供：
 * `globalThis.__UR_TWIN_IP__`（调试/验收）→ `ctx.config.ip` / `ctx.config.robotIp` / `ctx.options.ip`。
 */

import { createTwinState } from './state.js'
import { mountSidebarEntry } from './sidebar-entry.js'
import { mountThumbnail } from './thumbnail.js'
import { mountTwinPanel } from './twin-panel.js'

export const name = 'ur-digital-twin-client'

/** 缩略图插槽的标记属性（入口行之后的那一格）。 */
export const THUMB_SLOT_ATTRIBUTE = 'data-dsh-ur-twin-thumb'

/**
 * 解析**显式**指定的机器人 IP；没有任何显式来源时返回 `undefined`
 * （= 交给 host 解析当前已连接的机器人，见 Ruling 35）。
 */
export function resolveRobotIp(ctx, globalScope = globalThis) {
  const candidates = [
    globalScope?.__UR_TWIN_IP__,
    ctx?.config?.ip,
    ctx?.config?.robotIp,
    ctx?.options?.ip,
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim() !== '') return candidate.trim()
  }
  return undefined
}

/**
 * 挂载客户端半。
 *
 * @param {object} ctx cordis 上下文（只用到可选的 `logger` 与插件配置）
 * @returns {() => void} 清理函数（`ctx.effect` 语义：dispose 所有挂载并停止轮询）
 */
export function apply(ctx) {
  const doc = globalThis.document
  const ip = resolveRobotIp(ctx)
  const state = createTwinState({ ip })

  /** 调试标记：Task 1 的验收依赖 `loaded` / `at` 两个字段，不要删。 */
  const info = {
    loaded: true,
    at: Date.now(),
    ip,
    state,
    entry: undefined,
    thumbnail: undefined,
    error: null,
  }
  globalThis.__UR_TWIN__ = info

  ctx.logger?.info?.('[ur-twin] client half loaded')

  let entryHandle
  let thumbnailHandle

  try {
    state.start()

    // 缩略图容器由入口模块随入口行一起插入/自愈（React 重渲染后不会变成孤儿 DOM）。
    let thumbSlot
    entryHandle = mountSidebarEntry({
      doc,
      onToggle: (active) => {
        info.active = active
      },
      createSlot: (d) => {
        thumbSlot = d.createElement('div')
        thumbSlot.setAttribute(THUMB_SLOT_ATTRIBUTE, '')
        return thumbSlot
      },
      mountPanel: (container) => mountTwinPanel({ container, state }),
    })

    if (thumbSlot) {
      thumbnailHandle = mountThumbnail({ container: thumbSlot, state })
    }

    info.entry = entryHandle
    info.thumbnail = thumbnailHandle
    ctx.logger?.info?.(`[ur-twin] mounted (ip=${ip}, thumbnail=${Boolean(thumbnailHandle)})`)
  } catch (error) {
    // 客户端半装配失败不得拖垮 shell：如实记录到调试标记，清理函数照常返回。
    info.error = error instanceof Error ? error.message : String(error)
    ctx.logger?.warn?.(`[ur-twin] 客户端装配失败：${info.error}`)
  }

  return () => {
    try {
      entryHandle?.dispose?.()
    } catch {
      /* 忽略 */
    }
    try {
      thumbnailHandle?.dispose?.()
    } catch {
      /* 忽略 */
    }
    try {
      state.stop()
    } catch {
      /* 忽略 */
    }
    entryHandle = undefined
    thumbnailHandle = undefined
    delete globalThis.__UR_TWIN__
  }
}
