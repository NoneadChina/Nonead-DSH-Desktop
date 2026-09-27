/**
 * src/client/sidebar-entry.js — 侧边栏入口行（DOM 注入 + 自愈）+ 中栏大视图的挂载协调。
 *
 * ## 为什么是 DOM 注入（Ruling 30）
 * DSH 侧边栏没有向外部插件开放注册插槽，唯一可行的做法是把入口行**插进 shell 的 DOM**：
 * 位置定在「新建会话」按钮（`[class*="newSession"]`）**之后**、工作区浏览器之前。
 * 选择器与已装插件 `@linxin666/dsh-client-ui-task-board` 的发行版
 * （`shared/client/sidebar-entry-core.ts`）**完全一致** —— 各插件用同一组真实锚点，
 * 才不会互相猜选择器而踩踏。
 *
 * ## 自愈：全局单例 MutationObserver
 * React 重渲染会把插件注入的行当作"多余子节点"抹掉。对策是一个**全局单例** observer
 * （登记在 `globalThis[MUTATION_HUB_KEY]`，同一份模块的多份副本共享同一个 observer）：
 * `observe(document.body ?? document.documentElement, { childList: true, subtree: true })`，
 * 变更**批量到下一帧**（rAF 去抖）后统一交给订阅者；最后一个订阅者退订时 `disconnect()`。
 * **不要**每个挂载点各起一个 observer。
 *
 * ## 中栏是跨插件公共资源
 * `dsh-panel-activate`（`detail` = 激活者的面板名）用来协调：自己激活时派发该事件，
 * 收到**别人**的激活事件时收起自己的面板。没有这一步就会与 task-board / ssh 抢同一列。
 * 中栏容器可能尚未挂载（`querySelector` 返回 null）⇒ 挂载**必须可重试**，
 * 由上面那个 observer 驱动，不能只试一次。
 *
 * ## 可测性（Ruling 31）
 * 本环境**没有 DOM**：本模块只经由**注入的 `doc`** 使用 DOM（`querySelector` /
 * `createElement` / `addEventListener`），observer 实现与帧调度也都可以注入 ⇒
 * `test/sidebar-entry.test.mjs` 用手写假 document 即可覆盖
 * 插入位置 / 自愈 / 清理 / 激活事件协议 / 中栏容器重试。
 *
 * ## 样式
 * 本模块**不新增 `.css` 文件、也不改 `styles.js`**（那是 Task 8 的产物）：
 * 入口行与中栏容器的必要样式全部**内联**写在 DOM 上（`element.style`），
 * 同时置 `<html data-dsh-ur-twin-active>` 供后续样式表使用。理由见报告「偏差与理由」。
 */

/* ------------------------------------------------------------------ *
 * 真实锚点与标记常量（Ruling 30）
 * ------------------------------------------------------------------ */

/** 中栏（对话列）容器选择器；新老 shell 两种布局都保留，缺失即"尚未挂载"。 */
export const CONVERSATION_COLUMN_SELECTOR = '[data-pane="conversation"], [class*="centerCol"]'

/** 侧边栏「新建会话」锚点：入口行插在它之后。 */
export const NEW_SESSION_SELECTOR = '[class*="newSession"]'

/** 侧边栏行选择器（命中即说明用户切回了会话视图 ⇒ 收起大视图）。 */
export const SIDEBAR_ROW_SELECTOR =
  '[class*="sessionRow"], [class*="projectRow"], [class*="searchResultRow"], ' +
  '[class*="searchResultWorkspace"], [class*="newSession"]'

/** 侧边栏外层列选择器（定位注入根的起点）。 */
export const SIDEBAR_COLUMN_SELECTOR = '[data-pane="sidebar"], [class*="sidebarCol"]'

/** 侧边栏行容器（入口行插在它之后，而不是插进它内部）。 */
export const SIDEBAR_ROW_CONTAINER_SELECTOR = '[class*="logoRow"]'

/** 跨插件中栏激活事件；`detail` = 激活者面板名。 */
export const ACTIVATE_EVENT = 'dsh-panel-activate'

/** 入口行标记属性（`ENTRY_SELECTOR` 即据此命中，便于测试与宿主识别）。 */
export const ENTRY_ATTRIBUTE = 'data-dsh-ur-twin-entry'

/** 入口行选择器。 */
export const ENTRY_SELECTOR = `[${ENTRY_ATTRIBUTE}]`

/** 中栏大视图容器的标记属性（Task 8 的面板挂在其内）。 */
export const VIEW_ATTRIBUTE = 'data-dsh-ur-twin-view'

/** `<html>` 上的激活标记（供样式表隐藏对话内容）。 */
export const ACTIVE_ATTRIBUTE = 'data-dsh-ur-twin-active'

/** 本插件的面板名（激活事件的 `detail`）。 */
export const PANEL_NAME = 'ur-twin'

/** 入口行文案。 */
export const ENTRY_LABEL = 'UR 数字孪生'

/** 全局单例 MutationObserver 的登记键。 */
export const MUTATION_HUB_KEY = '__DSH_UR_TWIN_MUTATION_HUB__'

/** 入口行图标（内联 SVG，尺寸对齐 shell 的 18px 导航字形）。 */
const ICON =
  '<svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" ' +
  'stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M3 10.5V6.2l5-2.7 5 2.7v4.3"/><circle cx="8" cy="4.6" r="1.4"/>' +
  '<path d="M5.6 13.2 6.9 9.4M10.4 13.2 9.1 9.4M6.9 9.4h2.2"/></svg>'

/* ------------------------------------------------------------------ *
 * 内联样式（不新增样式表；见文件头「样式」）
 * ------------------------------------------------------------------ */

const ENTRY_STYLE = {
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  width: '100%',
  height: '36px',
  padding: '0 10px',
  border: 'none',
  borderRadius: '8px',
  background: 'transparent',
  color: 'var(--dsw-alias-label-secondary, #9aa4b2)',
  cursor: 'pointer',
  font: 'inherit',
  fontSize: '13px',
  textAlign: 'left',
  whiteSpace: 'nowrap',
}

const ENTRY_ACTIVE_STYLE = {
  background: 'var(--dsw-alias-interactive-bg-active, rgba(120, 160, 255, 0.16))',
  color: 'var(--dsw-alias-label-primary, #e6edf3)',
}

const SLOT_STYLE = {
  boxSizing: 'border-box',
  position: 'relative',
  width: '100%',
  height: '132px',
  margin: '4px 0 8px',
  overflow: 'hidden',
  borderRadius: '8px',
  background: 'rgba(255, 255, 255, 0.03)',
}

const VIEW_STYLE = {
  position: 'absolute',
  inset: '0',
  zIndex: '60',
  overflow: 'hidden',
  background: 'var(--dsw-alias-bg-base, #0d1117)',
}

/* ------------------------------------------------------------------ *
 * 小工具（全部对"缺失/极简环境"容错，绝不抛错）
 * ------------------------------------------------------------------ */

/** 取值安全的 globalThis（Node 与浏览器都有，但保持防御）。 */
function registry() {
  return typeof globalThis === 'undefined' ? undefined : globalThis
}

/** 写内联样式（对象里是带单位的字符串；`element.style` 不存在时静默跳过）。 */
function setStyle(el, props) {
  if (!el || !el.style) return
  for (const key of Object.keys(props)) el.style[key] = props[key]
}

/**
 * 节点是否仍挂在文档上。
 * 真实 DOM 用 `isConnected`；手写假 DOM 缺这个字段时退回 `parentElement` 判断。
 */
function isConnected(node) {
  if (!node) return false
  if (typeof node.isConnected === 'boolean') return node.isConnected
  return node.parentElement !== null && node.parentElement !== undefined
}

/** 造一个跨插件激活事件；无 `CustomEvent` 的极简环境退回同形状的普通对象。 */
function makeActivateEvent(doc, detail) {
  const CustomEventImpl = doc?.defaultView?.CustomEvent ?? registry()?.CustomEvent
  if (typeof CustomEventImpl === 'function') return new CustomEventImpl(ACTIVATE_EVENT, { detail })
  return { type: ACTIVATE_EVENT, detail }
}

/* ------------------------------------------------------------------ *
 * 全局单例 MutationObserver hub
 * ------------------------------------------------------------------ */

function resolveObserverImpl(doc, provided) {
  if (typeof provided === 'function') return provided
  const fromDoc = doc?.defaultView?.MutationObserver
  if (typeof fromDoc === 'function') return fromDoc
  const fromGlobal = registry()?.MutationObserver
  return typeof fromGlobal === 'function' ? fromGlobal : undefined
}

function resolveRaf(doc, provided) {
  if (typeof provided === 'function') return provided
  const view = doc?.defaultView
  if (view && typeof view.requestAnimationFrame === 'function') return (cb) => view.requestAnimationFrame(cb)
  const fromGlobal = registry()?.requestAnimationFrame
  return typeof fromGlobal === 'function' ? (cb) => fromGlobal(cb) : undefined
}

function resolveCaf(doc, provided) {
  if (typeof provided === 'function') return provided
  const view = doc?.defaultView
  if (view && typeof view.cancelAnimationFrame === 'function') return (id) => view.cancelAnimationFrame(id)
  const fromGlobal = registry()?.cancelAnimationFrame
  return typeof fromGlobal === 'function' ? (id) => fromGlobal(id) : undefined
}

/** 无 globalThis（极端环境）时的本地兜底槽位，保证 hub 语义不依赖全局对象。 */
let localHub

function readHub() {
  const reg = registry()
  return reg ? reg[MUTATION_HUB_KEY] : localHub
}

function writeHub(hub) {
  const reg = registry()
  if (reg) reg[MUTATION_HUB_KEY] = hub
  else localHub = hub
}

function clearHub(hub) {
  const reg = registry()
  if (reg) {
    if (reg[MUTATION_HUB_KEY] === hub) delete reg[MUTATION_HUB_KEY]
  } else if (localHub === hub) {
    localHub = undefined
  }
}

function createHub({ doc, options }) {
  const Observer = resolveObserverImpl(doc, options.MutationObserver)
  const raf = resolveRaf(doc, options.raf)
  const caf = resolveCaf(doc, options.caf)

  const subscribers = new Set()
  const hub = { subscribers, pending: [], scheduled: false, frame: undefined, observer: undefined, raf, caf }

  /** 把这一帧攒下的变更一次性交给所有订阅者；单个订阅者抛错不得影响其它订阅者。 */
  const flush = () => {
    hub.frame = undefined
    hub.scheduled = false
    const batch = hub.pending
    hub.pending = []
    for (const listener of [...subscribers]) {
      if (!subscribers.has(listener)) continue
      try {
        listener(batch)
      } catch {
        /* 订阅者自身的问题，吞掉 */
      }
    }
  }

  /** rAF 去抖：一帧只处理一次。无 rAF（Node / 极简环境）时退化为同步 flush。 */
  const schedule = () => {
    if (hub.scheduled) return
    hub.scheduled = true
    if (typeof raf === 'function') {
      try {
        hub.frame = raf(flush)
        return
      } catch {
        /* 调度器自身出错 → 退化到同步 flush */
      }
    }
    flush()
  }

  const target = doc ? (doc.body ?? doc.documentElement) : undefined
  if (typeof Observer === 'function' && target) {
    try {
      hub.observer = new Observer((records) => {
        for (const record of records) hub.pending.push(record)
        schedule()
      })
      hub.observer.observe(target, { childList: true, subtree: true })
    } catch {
      hub.observer = undefined
    }
  }

  return hub
}

/** 订阅 body 级变更；返回退订函数（最后一个退订者负责 disconnect）。 */
function subscribeMutations(doc, options, listener) {
  let hub = readHub()
  if (hub === undefined) {
    hub = createHub({ doc, options })
    // 没有 observer 的 hub 不进全局槽位：否则会挡住后续挂载点拿到可用的单例。
    if (hub.observer) writeHub(hub)
  }
  hub.subscribers.add(listener)
  let subscribed = true
  return () => {
    if (!subscribed) return
    subscribed = false
    hub.subscribers.delete(listener)
    if (hub.subscribers.size > 0) return
    // 最后一个订阅者退订：断开 observer、取消待处理帧、清空 hub（下一个订阅者会重建）。
    try {
      hub.observer?.disconnect?.()
    } catch {
      /* 忽略 */
    }
    if (hub.frame !== undefined && typeof hub.caf === 'function') {
      try {
        hub.caf(hub.frame)
      } catch {
        /* 忽略 */
      }
    }
    hub.frame = undefined
    hub.scheduled = false
    hub.pending = []
    clearHub(hub)
  }
}

/**
 * 仅测试用：丢弃全局单例 hub（断开 observer 并清空订阅者表）。
 * 生产代码不要调用 —— 它会让仍在挂载中的入口失去自愈。
 */
export function resetMutationHub() {
  const hub = readHub()
  if (!hub) return
  try {
    hub.observer?.disconnect?.()
  } catch {
    /* 忽略 */
  }
  hub.subscribers.clear()
  hub.pending = []
  hub.frame = undefined
  hub.scheduled = false
  clearHub(hub)
}

/* ------------------------------------------------------------------ *
 * DOM 定位与注入
 * ------------------------------------------------------------------ */

/** 侧边栏注入根：优先「新会话」所在行的父节点，退化到列的首个子元素。 */
function sidebarRoot(doc) {
  const column = doc.querySelector(SIDEBAR_COLUMN_SELECTOR)
  if (!column) return undefined
  if (typeof column.querySelector === 'function') {
    const row = column.querySelector(SIDEBAR_ROW_CONTAINER_SELECTOR)
    if (row?.parentElement) return row.parentElement
  }
  return column.firstElementChild ?? column
}

function closestRow(anchor, selector) {
  if (typeof anchor.closest !== 'function') return null
  try {
    return anchor.closest(selector)
  } catch {
    return null
  }
}

/**
 * 把若干节点按顺序插到「新建会话」之后（行容器是注入根直接子节点时，插在行容器之后）。
 * @returns {boolean} 是否完成插入（锚点未就绪时返回 false，等下一次 observer flush 重试）
 */
function placeNodes(doc, nodes) {
  const anchor = doc.querySelector(NEW_SESSION_SELECTOR)
  if (!anchor || !anchor.parentElement) return false
  if (nodes.some((n) => n === anchor)) return false

  const root = sidebarRoot(doc)
  const row = closestRow(anchor, SIDEBAR_ROW_CONTAINER_SELECTOR)
  const base = row && root && row.parentElement === root ? row : anchor
  const parent = base.parentElement
  if (!parent || typeof parent.insertBefore !== 'function') return false

  let ref = base
  for (const node of nodes) {
    parent.insertBefore(node, ref.nextSibling ?? null)
    ref = node
  }
  return true
}

/** 造入口行（button + 图标 + 文案）。 */
function createEntryElement(doc) {
  const entry = doc.createElement('button')
  entry.setAttribute('type', 'button')
  entry.setAttribute(ENTRY_ATTRIBUTE, '')
  entry.setAttribute('data-dsh-plugin', 'ur-digital-twin')
  entry.setAttribute('aria-label', ENTRY_LABEL)
  entry.setAttribute('title', ENTRY_LABEL)
  entry.setAttribute('aria-pressed', 'false')
  if (typeof entry.className === 'string') entry.className = 'dsh-ur-twin-entry'
  setStyle(entry, ENTRY_STYLE)

  const icon = doc.createElement('span')
  icon.setAttribute('aria-hidden', 'true')
  icon.innerHTML = ICON
  setStyle(icon, { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none', width: '24px', height: '24px' })

  const label = doc.createElement('span')
  label.textContent = ENTRY_LABEL
  setStyle(label, { overflow: 'hidden', textOverflow: 'ellipsis' })

  entry.appendChild(icon)
  entry.appendChild(label)
  return entry
}

/* ------------------------------------------------------------------ *
 * 挂载
 * ------------------------------------------------------------------ */

/**
 * 挂载侧边栏入口行，并协调中栏大视图的挂载/收起。
 *
 * @param {object} [options]
 * @param {Document} [options.doc=globalThis.document] 目标文档（**唯一**的 DOM 入口，测试注入假对象）
 * @param {(active: boolean) => void} [options.onToggle] 点击切换后的通知回调（不参与状态决策）
 * @param {(container: Element) => ({dispose?: Function}|void)} [options.mountPanel]
 *        中栏容器就绪后调用一次（下标：本插件的大视图，如 `mountTwinPanel`）；返回值需含 `dispose`
 * @param {(doc: Document) => Element} [options.createSlot]
 *        可选的"附加插槽"工厂（如侧边栏缩略图容器）：插在入口行**之后**，
 *        与入口行**同生共死**（一起重插、一起移除），React 重渲染后不会变成孤儿
 * @param {string} [options.panelName='ur-twin'] 本插件面板名（激活事件的 `detail`）
 * @param {Function} [options.MutationObserver] observer 实现注入点（缺省 `doc.defaultView.MutationObserver`）
 * @param {Function} [options.raf] 帧调度注入点（缺省 `doc.defaultView.requestAnimationFrame`）
 * @param {Function} [options.caf] 帧取消注入点（缺省 `doc.defaultView.cancelAnimationFrame`）
 * @returns {{dispose: () => void, isActive: () => boolean, toggle: () => void, setActive: (active: boolean) => void}}
 *          幂等句柄（无可用 doc 时是安全空转句柄）
 */
export function mountSidebarEntry({
  doc = registry()?.document,
  onToggle,
  mountPanel,
  createSlot,
  panelName = PANEL_NAME,
  MutationObserver: ObserverImpl,
  raf,
  caf,
} = {}) {
  if (!doc || typeof doc.createElement !== 'function' || typeof doc.querySelector !== 'function') {
    // 无 DOM（Node / 极端环境）：不抛错，返回安全空转句柄。
    return { dispose() {}, isActive: () => false, toggle() {}, setActive() {} }
  }

  const options = { MutationObserver: ObserverImpl, raf, caf }

  let disposed = false
  let active = false
  let entry
  let slot
  let container
  let panel
  let unsubscribeMutations = () => {}

  /* ---------------- 入口行与插槽 ---------------- */

  const ownedNodes = () => {
    const nodes = []
    if (entry) nodes.push(entry)
    if (slot) nodes.push(slot)
    return nodes
  }

  /** 入口行/插槽缺失或被 React 抹掉时重新插回（下一次 observer flush 调用）。 */
  const ensureEntry = () => {
    if (disposed) return
    if (!entry) {
      entry = createEntryElement(doc)
      entry.addEventListener('click', onClick)
      if (typeof createSlot === 'function') {
        try {
          const created = createSlot(doc)
          if (created) {
            slot = created
            setStyle(slot, SLOT_STYLE)
          }
        } catch {
          slot = undefined
        }
      }
    }
    const nodes = ownedNodes()
    if (nodes.every(isConnected)) return
    placeNodes(doc, nodes)
  }

  /* ---------------- 中栏大视图（可重试） ---------------- */

  const teardownPanel = () => {
    if (panel) {
      try {
        panel.dispose?.()
      } catch {
        /* 面板自身的问题，吞掉 */
      }
      panel = undefined
    }
    if (container) {
      try {
        container.remove?.()
      } catch {
        /* 忽略 */
      }
      container = undefined
    }
  }

  /**
   * 保证中栏容器存在并挂上面板。容器/中栏都**可能尚未挂载**：
   * 这里只做"能挂就挂"，其余交给下一次 observer flush 重试 —— 绝不抛错。
   */
  const ensurePanel = () => {
    if (disposed || !active) return
    if (container && !isConnected(container)) {
      // React 重建了中栏：旧容器与旧面板一起作废，下一轮重挂。
      teardownPanel()
    }
    if (!container) {
      const column = doc.querySelector(CONVERSATION_COLUMN_SELECTOR)
      if (!column || typeof column.appendChild !== 'function') return
      container = doc.createElement('div')
      container.setAttribute(VIEW_ATTRIBUTE, '')
      container.setAttribute('data-dsh-plugin', 'ur-digital-twin')
      setStyle(container, VIEW_STYLE)
      column.appendChild(container)
    }
    if (panel || typeof mountPanel !== 'function') return
    try {
      panel = mountPanel(container) ?? undefined
    } catch {
      panel = undefined
    }
  }

  /** observer flush：补齐入口行 + 补齐中栏挂载（两件都是"可重试"的事）。 */
  const reconcile = () => {
    ensureEntry()
    ensurePanel()
  }

  /* ---------------- 激活状态与事件协议 ---------------- */

  const paintActive = () => {
    const root = doc.documentElement
    if (entry) {
      if (active) entry.setAttribute('data-active', '')
      else entry.removeAttribute('data-active')
      entry.setAttribute('aria-pressed', active ? 'true' : 'false')
      setStyle(entry, active ? ENTRY_ACTIVE_STYLE : { background: ENTRY_STYLE.background, color: ENTRY_STYLE.color })
    }
    if (active) root?.setAttribute?.(ACTIVE_ATTRIBUTE, '')
    else root?.removeAttribute?.(ACTIVE_ATTRIBUTE)
  }

  const setActive = (next) => {
    if (disposed) return
    const wanted = next === true
    if (wanted === active) {
      if (wanted) ensurePanel()
      return
    }
    active = wanted
    paintActive()
    if (active) {
      ensurePanel()
      // 自己激活：派发跨插件事件，让别人收起他们的面板。
      doc.dispatchEvent?.(makeActivateEvent(doc, panelName))
    } else {
      teardownPanel()
    }
    if (typeof onToggle === 'function') {
      try {
        onToggle(active)
      } catch {
        /* 回调自身的问题，吞掉 */
      }
    }
  }

  const toggle = () => setActive(!active)

  function onClick(event) {
    event?.preventDefault?.()
    toggle()
  }

  /** 别的插件激活了中栏 ⇒ 收起自己的面板（不反向派发事件，避免事件回环）。 */
  const onActivate = (event) => {
    if (disposed) return
    const detail = event?.detail
    if (detail === panelName) return
    if (active) setActive(false)
  }

  /** 用户点了侧边栏任意行（含"新建会话"）⇒ 回到会话视图。 */
  const onDocumentClick = (event) => {
    if (disposed || !active) return
    const target = event?.target
    if (!target || typeof target.closest !== 'function') return
    let hit = null
    try {
      hit = target.closest(SIDEBAR_ROW_SELECTOR)
    } catch {
      hit = null
    }
    if (hit && hit !== entry && !(slot && slot.contains?.(target))) setActive(false)
  }

  /* ---------------- 启动与清理 ---------------- */

  doc.addEventListener(ACTIVATE_EVENT, onActivate)
  doc.addEventListener('click', onDocumentClick, true)
  unsubscribeMutations = subscribeMutations(doc, options, reconcile)
  ensureEntry()

  return {
    isActive: () => active,
    toggle,
    setActive,
    dispose() {
      if (disposed) return
      disposed = true
      try {
        unsubscribeMutations()
      } catch {
        /* 忽略 */
      }
      unsubscribeMutations = () => {}
      try {
        entry?.removeEventListener?.('click', onClick)
      } catch {
        /* 忽略 */
      }
      try {
        doc.removeEventListener?.(ACTIVATE_EVENT, onActivate)
      } catch {
        /* 忽略 */
      }
      try {
        doc.removeEventListener?.('click', onDocumentClick, true)
      } catch {
        /* 忽略 */
      }
      teardownPanel()
      for (const node of ownedNodes()) {
        try {
          node.remove?.()
        } catch {
          /* 忽略 */
        }
      }
      entry = undefined
      slot = undefined
      active = false
      try {
        doc.documentElement?.removeAttribute?.(ACTIVE_ATTRIBUTE)
      } catch {
        /* 忽略 */
      }
    },
  }
}
