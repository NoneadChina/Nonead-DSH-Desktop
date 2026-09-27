/**
 * test/sidebar-entry.test.mjs — Task 9：侧边栏入口注入（自愈）+ 中栏激活协议 + 容器重试。
 *
 * 本环境**没有 DOM**：这里手写一个够用的假 document（querySelector / createElement /
 * insertBefore / addEventListener + 可受控触发的假 MutationObserver），
 * 用它覆盖简报要求的 6 条行为：
 *   ① 插到 `[class*="newSession"]` 之后且带 `data-dsh-ur-twin-entry`
 *   ② 被 React 抹掉后，**下一次 observer 触发**时重新插入（自愈）
 *   ③ `dispose()` 摘 DOM、断开 observer、移除监听（且幂等）
 *   ④ 激活事件协议：点击 → 激活并派发 `dsh-panel-activate`；收到别人的 → 收起
 *   ⑤ 中栏容器不存在时不抛错，容器出现后自动完成挂载（可重试）
 *   ⑥ 附加插槽（缩略图容器）随入口行一起插入/移除；全局单例 observer 只建一个
 *
 * 运行：node --test test/sidebar-entry.test.mjs
 * （**不要**用 npm test：当前沙箱下 npm 的 piped stdio 会 spawn EPERM）
 */

import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import {
  ACTIVATE_EVENT,
  ACTIVE_ATTRIBUTE,
  CONVERSATION_COLUMN_SELECTOR,
  ENTRY_ATTRIBUTE,
  ENTRY_SELECTOR,
  NEW_SESSION_SELECTOR,
  PANEL_NAME,
  SIDEBAR_ROW_SELECTOR,
  VIEW_ATTRIBUTE,
  mountSidebarEntry,
  resetMutationHub,
} from '../src/client/sidebar-entry.js'

/* ================================================================== *
 * 假 DOM
 * ================================================================== */

/** 支持的选择器子集：`[attr]`、`[attr="v"]`、`[class*="v"]`、标签名、逗号分隔。 */
function matchesSimple(el, simple) {
  if (!simple) return false
  if (!simple.startsWith('[')) return el.tagName.toLowerCase() === simple.toLowerCase()
  const m = /^\[([\w-]+)(?:([*^$~|]?=)"([^"]*)")?\]$/.exec(simple)
  if (!m) return false
  const [, name, op, value] = m
  if (op === undefined) return el.hasAttribute(name)
  const raw = el.getAttribute(name)
  if (raw === null || raw === undefined) return false
  const actual = String(raw)
  if (op === '*=') return actual.includes(value)
  return actual === value
}

function matchesSelector(el, selector) {
  return String(selector)
    .split(',')
    .some((part) => matchesSimple(el, part.trim()))
}

class FakeElement {
  constructor(tagName) {
    this.tagName = String(tagName).toUpperCase()
    this.children = []
    this.parentNode = null
    this.attributes = new Map()
    this.style = {}
    this.listeners = new Map()
    this.ownerDocument = null
    this.innerHTML = ''
    this.textContent = ''
    this.disabled = false
    this.__root = false
  }

  get className() {
    return this.attributes.get('class') ?? ''
  }

  set className(value) {
    this.attributes.set('class', String(value))
  }

  get parentElement() {
    return this.parentNode
  }

  get firstElementChild() {
    return this.children[0] ?? null
  }

  get nextSibling() {
    const parent = this.parentNode
    if (!parent) return null
    const i = parent.children.indexOf(this)
    return i < 0 ? null : (parent.children[i + 1] ?? null)
  }

  get previousElementSibling() {
    const parent = this.parentNode
    if (!parent) return null
    const i = parent.children.indexOf(this)
    return i <= 0 ? null : parent.children[i - 1]
  }

  get nextElementSibling() {
    return this.nextSibling
  }

  get isConnected() {
    let node = this
    while (node.parentNode) node = node.parentNode
    return node.__root === true
  }

  appendChild(node) {
    node.parentNode?.removeChild(node)
    this.children.push(node)
    node.parentNode = this
    if (!node.ownerDocument) node.ownerDocument = this.ownerDocument
    return node
  }

  insertBefore(node, ref) {
    node.parentNode?.removeChild(node)
    const i = ref ? this.children.indexOf(ref) : -1
    if (i < 0) this.children.push(node)
    else this.children.splice(i, 0, node)
    node.parentNode = this
    if (!node.ownerDocument) node.ownerDocument = this.ownerDocument
    return node
  }

  removeChild(node) {
    const i = this.children.indexOf(node)
    if (i >= 0) this.children.splice(i, 1)
    node.parentNode = null
    return node
  }

  remove() {
    this.parentNode?.removeChild(this)
  }

  contains(node) {
    let cursor = node
    while (cursor) {
      if (cursor === this) return true
      cursor = cursor.parentNode
    }
    return false
  }

  matches(selector) {
    return matchesSelector(this, selector)
  }

  closest(selector) {
    let node = this
    while (node) {
      if (matchesSelector(node, selector)) return node
      node = node.parentNode
    }
    return null
  }

  querySelector(selector) {
    return descend(this, selector)[0] ?? null
  }

  querySelectorAll(selector) {
    return descend(this, selector)
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value))
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null
  }

  hasAttribute(name) {
    return this.attributes.has(name)
  }

  removeAttribute(name) {
    this.attributes.delete(name)
  }

  addEventListener(type, fn) {
    const set = this.listeners.get(type) ?? new Set()
    set.add(fn)
    this.listeners.set(type, set)
  }

  removeEventListener(type, fn) {
    this.listeners.get(type)?.delete(fn)
  }

  listenerCount(type) {
    return this.listeners.get(type)?.size ?? 0
  }

  /** 近似冒泡：先自身、再祖先，最后 document（capture 与 bubble 不区分，够用即可）。 */
  dispatchEvent(event) {
    const ev = event ?? {}
    if (ev.target === undefined) ev.target = this
    let node = this
    while (node) {
      const fns = node.listeners?.get(ev.type)
      if (fns) for (const fn of [...fns]) fn(ev)
      node = node.parentNode
    }
    if (this.ownerDocument?.dispatchEvent) this.ownerDocument.dispatchEvent(ev)
    return true
  }
}

function descend(el, selector, out = []) {
  for (const child of el.children) {
    if (matchesSelector(child, selector)) out.push(child)
    descend(child, selector, out)
  }
  return out
}

function createFakeDom() {
  const html = new FakeElement('html')
  html.__root = true
  const body = new FakeElement('body')
  html.appendChild(body)

  const docListeners = new Map()
  const observers = []

  class FakeMutationObserver {
    constructor(callback) {
      this.callback = callback
      this.disconnected = false
      this.target = null
      this.options = null
      observers.push(this)
    }

    observe(target, options) {
      this.target = target
      this.options = options
    }

    disconnect() {
      this.disconnected = true
    }

    takeRecords() {
      return []
    }

    /** 测试专用：手动触发一次变更回调（真实 MutationObserver 的替代）。 */
    trigger(records = [{ type: 'childList' }]) {
      if (this.disconnected) return
      this.callback(records, this)
    }
  }

  class FakeCustomEvent {
    constructor(type, init = {}) {
      this.type = type
      this.detail = init.detail
    }
  }

  const doc = {
    documentElement: html,
    body,
    defaultView: { MutationObserver: FakeMutationObserver, CustomEvent: FakeCustomEvent },
    createElement(tag) {
      const el = new FakeElement(tag)
      el.ownerDocument = doc
      return el
    },
    querySelector(selector) {
      return descend(html, selector)[0] ?? null
    },
    querySelectorAll(selector) {
      return descend(html, selector)
    },
    addEventListener(type, fn) {
      const set = docListeners.get(type) ?? new Set()
      set.add(fn)
      docListeners.set(type, set)
    },
    removeEventListener(type, fn) {
      docListeners.get(type)?.delete(fn)
    },
    listenerCount(type) {
      return docListeners.get(type)?.size ?? 0
    },
    dispatchEvent(event) {
      for (const fn of [...(docListeners.get(event.type) ?? [])]) fn(event)
      return true
    },
  }
  html.ownerDocument = doc
  body.ownerDocument = doc

  return {
    doc,
    html,
    body,
    observers,
    makeEvent: (type, detail) => ({ type, detail, preventDefault() {} }),
  }
}

/** 受控帧调度：手动 `flush()` 才执行排队的回调（rAF 去抖因此可确定地复现）。 */
function createScheduler() {
  const queue = []
  const cancellations = []
  return {
    raf(cb) {
      queue.push(cb)
      return queue.length
    },
    caf(id) {
      cancellations.push(id)
      const i = id - 1
      if (i >= 0 && i < queue.length) queue[i] = null
    },
    flush() {
      for (const cb of queue.splice(0)) cb?.()
    },
    pending: () => queue.filter(Boolean).length,
    cancellations: () => cancellations,
  }
}

/** 造一个带「新建会话」行的侧边栏（结构对齐真实 shell：列 > logoRow > button）。 */
function buildSidebar(dom, { withSessionRow = true } = {}) {
  const doc = dom.doc
  const column = doc.createElement('div')
  column.className = 'sidebarCol'
  const logoRow = doc.createElement('div')
  logoRow.className = 'logoRow'
  const newSession = doc.createElement('button')
  newSession.className = 'newSessionBtn'
  logoRow.appendChild(newSession)
  column.appendChild(logoRow)
  let sessionRow
  if (withSessionRow) {
    sessionRow = doc.createElement('div')
    sessionRow.className = 'sessionRow'
    column.appendChild(sessionRow)
  }
  dom.body.appendChild(column)
  return { column, logoRow, newSession, sessionRow }
}

/** 中栏（对话列）——挂载前不存在，用来覆盖"容器缺失时重试"。 */
function buildCenterColumn(dom, className = 'centerCol') {
  const column = dom.doc.createElement('div')
  column.className = className
  dom.body.appendChild(column)
  return column
}

const entryOf = (dom) => dom.doc.querySelector(ENTRY_SELECTOR)
const viewOf = (dom) => dom.doc.querySelector(`[${VIEW_ATTRIBUTE}]`)
const click = (dom, el) => el.dispatchEvent(dom.makeEvent('click'))

beforeEach(() => resetMutationHub())
afterEach(() => resetMutationHub())

/* ================================================================== *
 * ① 插入位置与标记
 * ================================================================== */

test('① 入口行插在 [class*="newSession"] 之后，且带 data-dsh-ur-twin-entry', () => {
  const dom = createFakeDom()
  const { column, logoRow, newSession, sessionRow } = buildSidebar(dom)
  const scheduler = createScheduler()
  const handle = mountSidebarEntry({ doc: dom.doc, raf: scheduler.raf, caf: scheduler.caf })

  try {
    const entry = entryOf(dom)
    assert.ok(entry, '必须注入入口行')
    assert.equal(entry.getAttribute(ENTRY_ATTRIBUTE), '', '入口行必须带标记属性')
    assert.equal(entry.parentNode, column, '入口行必须插在侧边栏列下（与「新建会话」同一层）')
    assert.equal(entry.previousElementSibling, logoRow, '入口行必须紧跟在「新建会话」所在行之后')
    assert.equal(entry.nextElementSibling, sessionRow, '入口行必须仍排在会话行之前（在工作区浏览器之前）')
    assert.equal(newSession.parentNode, logoRow, '原「新建会话」按钮不得被挪走')
    assert.equal(dom.doc.querySelectorAll(NEW_SESSION_SELECTOR).length, 1, '不得复制「新建会话」锚点')
    assert.equal(handle.isActive(), false, '初始未激活')
  } finally {
    handle.dispose()
  }
})

/* ================================================================== *
 * ② 自愈
 * ================================================================== */

test('② 入口被 React 抹掉后，下一次 observer 触发时重新插入（自愈）', () => {
  const dom = createFakeDom()
  const { column, logoRow } = buildSidebar(dom)
  const scheduler = createScheduler()
  const handle = mountSidebarEntry({ doc: dom.doc, raf: scheduler.raf, caf: scheduler.caf })

  try {
    const observer = dom.observers.at(-1)
    assert.equal(dom.observers.length, 1, '自愈必须用一个 observer')
    assert.equal(observer.target, dom.body, 'observer 必须观察 body')
    assert.deepEqual(observer.options, { childList: true, subtree: true })

    entryOf(dom).remove() // 模拟 React 把"多余子节点"删掉
    assert.equal(entryOf(dom), null, '前置条件：入口已被抹掉')
    assert.equal(scheduler.pending(), 0, '尚未触发变更：不应有排队帧')

    observer.trigger()
    assert.equal(scheduler.pending(), 1, '变更必须 rAF 去抖到下一帧（而不是同步处理）')
    assert.equal(entryOf(dom), null, 'flush 之前不得插入')

    scheduler.flush()
    const healed = entryOf(dom)
    assert.ok(healed, 'flush 之后必须自愈')
    assert.equal(healed.parentNode, column)
    assert.equal(healed.previousElementSibling, logoRow, '自愈后仍在「新建会话」之后')

    // 整列被 React 重建（新列 + 新锚点）时也必须重新定位。
    column.remove()
    const rebuilt = buildSidebar(dom, { withSessionRow: false })
    observer.trigger()
    scheduler.flush()
    assert.equal(entryOf(dom).parentNode, rebuilt.column, '列被重建后必须插进新列')
  } finally {
    handle.dispose()
  }
})

/* ================================================================== *
 * ③ dispose 清理（幂等）
 * ================================================================== */

test('③ dispose() 摘 DOM、断开 observer、移除监听，且幂等、之后不再自愈', () => {
  const dom = createFakeDom()
  buildSidebar(dom)
  const scheduler = createScheduler()
  const handle = mountSidebarEntry({ doc: dom.doc, raf: scheduler.raf, caf: scheduler.caf })

  const observer = dom.observers.at(-1)
  assert.equal(dom.doc.listenerCount(ACTIVATE_EVENT), 1, '挂载期间应监听激活事件')
  assert.equal(dom.doc.listenerCount('click'), 1, '挂载期间应监听侧边栏点击')

  handle.dispose()

  assert.equal(entryOf(dom), null, 'dispose 必须摘掉自己的 DOM')
  assert.equal(observer.disconnected, true, '最后一个订阅者退订必须 disconnect observer')
  assert.equal(dom.doc.listenerCount(ACTIVATE_EVENT), 0, '必须移除激活事件监听')
  assert.equal(dom.doc.listenerCount('click'), 0, '必须移除点击监听')
  assert.equal(dom.html.hasAttribute(ACTIVE_ATTRIBUTE), false, '不得残留 <html> 激活标记')

  handle.dispose() // 幂等
  assert.equal(entryOf(dom), null)

  observer.trigger()
  scheduler.flush()
  assert.equal(entryOf(dom), null, 'dispose 之后不得再自愈')
})

test('③b 多个挂载点共享同一个全局单例 observer，最后一个退订才 disconnect', () => {
  const dom = createFakeDom()
  buildSidebar(dom)
  const scheduler = createScheduler()
  const a = mountSidebarEntry({ doc: dom.doc, raf: scheduler.raf, caf: scheduler.caf })
  const b = mountSidebarEntry({ doc: dom.doc, raf: scheduler.raf, caf: scheduler.caf })

  try {
    assert.equal(dom.observers.length, 1, '两个挂载点必须共用同一个 observer')
    assert.equal(dom.doc.querySelectorAll(ENTRY_SELECTOR).length, 2, '两个挂载点各插一行')

    a.dispose()
    assert.equal(dom.observers[0].disconnected, false, '还有人订阅时不得断开 observer')
    b.dispose()
    assert.equal(dom.observers[0].disconnected, true, '最后一个退订才断开')

    // hub 已清理：下一次挂载重建 observer（不是复用已 disconnect 的那个）。
    const c = mountSidebarEntry({ doc: dom.doc, raf: scheduler.raf, caf: scheduler.caf })
    assert.equal(dom.observers.length, 2)
    c.dispose()
  } finally {
    a.dispose()
    b.dispose()
  }
})

test('③c 无 DOM 时不抛错：返回安全空转句柄', () => {
  const handle = mountSidebarEntry({ doc: undefined })
  assert.equal(handle.isActive(), false)
  assert.doesNotThrow(() => handle.toggle())
  assert.doesNotThrow(() => handle.setActive(true))
  assert.equal(handle.isActive(), false)
  assert.doesNotThrow(() => handle.dispose())
  assert.doesNotThrow(() => handle.dispose())
})

/* ================================================================== *
 * ④ 激活事件协议
 * ================================================================== */

test('④ 点击入口 → 激活并派发 dsh-panel-activate；收到别人的激活事件 → 收起', () => {
  const dom = createFakeDom()
  buildSidebar(dom)
  const scheduler = createScheduler()
  const seen = []
  dom.doc.addEventListener(ACTIVATE_EVENT, (event) => seen.push(event.detail))
  const toggles = []
  const handle = mountSidebarEntry({
    doc: dom.doc,
    raf: scheduler.raf,
    caf: scheduler.caf,
    onToggle: (active) => toggles.push(active),
  })

  try {
    const entry = entryOf(dom)
    assert.equal(entry.getAttribute('aria-pressed'), 'false')

    click(dom, entry)
    assert.equal(handle.isActive(), true, '点击必须激活')
    assert.deepEqual(seen, [PANEL_NAME], '激活时必须派发 dsh-panel-activate（detail = 自己）')
    assert.deepEqual(toggles, [true], 'onToggle 应收到新状态')
    assert.equal(entry.getAttribute('aria-pressed'), 'true')
    assert.equal(entry.hasAttribute('data-active'), true, '入口行应有激活标记')
    assert.equal(dom.html.hasAttribute(ACTIVE_ATTRIBUTE), true, '<html> 应有激活标记（供样式表隐藏对话）')

    // 自己的事件不得导致自己收起
    dom.doc.dispatchEvent(dom.makeEvent(ACTIVATE_EVENT, PANEL_NAME))
    assert.equal(handle.isActive(), true, '自己的激活事件不得收起自己')

    // 别的插件激活中栏 ⇒ 收起自己的面板，且不反向派发事件
    seen.length = 0
    dom.doc.dispatchEvent(dom.makeEvent(ACTIVATE_EVENT, 'taskboard'))
    assert.equal(handle.isActive(), false, '别人的激活事件必须收起自己的面板')
    assert.deepEqual(
      seen.filter((detail) => detail === PANEL_NAME),
      [],
      '收起时不得再派发自己的激活事件（否则事件回环）',
    )
    assert.deepEqual(toggles, [true, false])
    assert.equal(entry.hasAttribute('data-active'), false)
    assert.equal(dom.html.hasAttribute(ACTIVE_ATTRIBUTE), false)

    // 再点一次 → 重新激活（切换语义）
    seen.length = 0
    click(dom, entry)
    assert.equal(handle.isActive(), true)
    assert.deepEqual(seen, [PANEL_NAME], '重新激活时仍必须派发自己的激活事件')

    // 收起路径：再点一次
    click(dom, entry)
    assert.equal(handle.isActive(), false)
    assert.equal(dom.html.hasAttribute(ACTIVE_ATTRIBUTE), false)
  } finally {
    handle.dispose()
  }
})

test('④b 激活状态下点击侧边栏行（含「新建会话」）⇒ 回到会话视图', () => {
  const dom = createFakeDom()
  const { sessionRow, newSession } = buildSidebar(dom)
  const scheduler = createScheduler()
  const handle = mountSidebarEntry({ doc: dom.doc, raf: scheduler.raf, caf: scheduler.caf })

  try {
    click(dom, entryOf(dom))
    assert.equal(handle.isActive(), true)

    click(dom, sessionRow)
    assert.equal(handle.isActive(), false, '点击会话行必须收起大视图')

    click(dom, entryOf(dom))
    assert.equal(handle.isActive(), true)
    click(dom, newSession)
    assert.equal(handle.isActive(), false, '点击「新建会话」必须收起大视图')

    // 点击入口行自身只是在切换，不得被"行点击"逻辑立刻关掉
    click(dom, entryOf(dom))
    assert.equal(handle.isActive(), true, '点击入口自身不得被侧边栏行规则误关')

    // 行选择器确实命中"侧边栏行"，且**不**命中入口行（否则点击入口会被立刻关掉）
    assert.equal(sessionRow.matches(SIDEBAR_ROW_SELECTOR), true)
    assert.equal(newSession.matches(SIDEBAR_ROW_SELECTOR), true)
    assert.equal(entryOf(dom).matches(SIDEBAR_ROW_SELECTOR), false, '入口行不得命中行选择器')
  } finally {
    handle.dispose()
  }
})

/* ================================================================== *
 * ⑤ 中栏容器缺失 ⇒ 不抛错 + 稍后自动挂载（可重试）
 * ================================================================== */

test('⑤ 中栏容器不存在时不抛错，容器出现后自动完成挂载（并可重挂）', () => {
  const dom = createFakeDom()
  buildSidebar(dom)
  const scheduler = createScheduler()
  const observer = () => dom.observers.at(-1)
  const mountedContainers = []
  let disposedPanels = 0
  const handle = mountSidebarEntry({
    doc: dom.doc,
    raf: scheduler.raf,
    caf: scheduler.caf,
    mountPanel: (container) => {
      mountedContainers.push(container)
      return { dispose: () => { disposedPanels++ } }
    },
  })

  try {
    assert.equal(dom.doc.querySelector(CONVERSATION_COLUMN_SELECTOR), null, '前置条件：中栏尚未挂载')
    assert.doesNotThrow(() => click(dom, entryOf(dom)), '中栏缺失时点击不得抛错')
    assert.equal(mountedContainers.length, 0, '中栏不存在时不得调用 mountPanel')

    observer().trigger()
    scheduler.flush()
    assert.equal(mountedContainers.length, 0, '重试也必须等到中栏真的出现')

    // 中栏挂载（React 稍后渲染出来）⇒ 下一次 flush 自动完成挂载
    const column = buildCenterColumn(dom)
    observer().trigger()
    scheduler.flush()
    assert.equal(mountedContainers.length, 1, '中栏出现后必须自动挂载')
    const container = mountedContainers[0]
    assert.equal(container.parentNode, column, '视图容器必须是中栏的子节点')
    assert.equal(container.getAttribute(VIEW_ATTRIBUTE), '', '视图容器必须带 data-dsh-ur-twin-view')
    assert.equal(container.style.position, 'absolute', '视图容器必须覆盖中栏（内联样式）')

    // 再次 flush 不得重复挂载
    observer().trigger()
    scheduler.flush()
    assert.equal(mountedContainers.length, 1, '重复 flush 不得重复 mountPanel')

    // 中栏被重建：容器失联 ⇒ 旧面板 dispose；新中栏出现后再重挂
    column.remove()
    observer().trigger()
    scheduler.flush()
    assert.equal(disposedPanels, 1, '容器被移除时必须 dispose 旧面板')
    assert.equal(mountedContainers.length, 1, '新中栏尚未出现时不得重挂')

    const column2 = buildCenterColumn(dom, 'centerCol2')
    observer().trigger()
    scheduler.flush()
    assert.equal(mountedContainers.length, 2, '必须在新中栏里重挂')
    assert.equal(mountedContainers[1].parentNode, column2)

    // 收起：面板 dispose、容器移除
    click(dom, entryOf(dom))
    assert.equal(handle.isActive(), false)
    assert.equal(disposedPanels, 2, '收起时必须 dispose 面板')
    assert.equal(dom.doc.querySelector(`[${VIEW_ATTRIBUTE}]`), null, '收起时必须移除视图容器')
  } finally {
    handle.dispose()
  }
})

test('⑤b mountPanel 抛错不得逃逸（装配失败不能拖垮 shell）', () => {
  const dom = createFakeDom()
  buildSidebar(dom)
  buildCenterColumn(dom)
  const scheduler = createScheduler()
  const handle = mountSidebarEntry({
    doc: dom.doc,
    raf: scheduler.raf,
    caf: scheduler.caf,
    mountPanel: () => {
      throw new Error('no webgl')
    },
  })

  try {
    assert.doesNotThrow(() => click(dom, entryOf(dom)))
    assert.equal(handle.isActive(), true, '面板挂载失败不影响激活状态')
    assert.doesNotThrow(() => {
      dom.observers.at(-1).trigger()
      scheduler.flush()
    })
  } finally {
    handle.dispose()
  }
})

/* ================================================================== *
 * ⑥ 附加插槽（缩略图容器）随入口行同生共死
 * ================================================================== */

test('⑥ createSlot 提供的插槽紧跟入口行插入、随 dispose 一起移除、并随自愈重插', () => {
  const dom = createFakeDom()
  const { column, logoRow } = buildSidebar(dom)
  const scheduler = createScheduler()
  const handle = mountSidebarEntry({
    doc: dom.doc,
    raf: scheduler.raf,
    caf: scheduler.caf,
    createSlot: (d) => {
      const slot = d.createElement('div')
      slot.setAttribute('data-dsh-ur-twin-thumb', '')
      return slot
    },
  })

  try {
    const entry = entryOf(dom)
    const slot = dom.doc.querySelector('[data-dsh-ur-twin-thumb]')
    assert.ok(slot, '必须创建插槽')
    assert.equal(slot.parentNode, column)
    assert.equal(slot.previousElementSibling, entry, '插槽必须紧跟入口行')
    assert.equal(entry.previousElementSibling, logoRow)
    assert.equal(slot.style.position, 'relative')

    slot.remove()
    dom.observers.at(-1).trigger()
    scheduler.flush()
    assert.equal(dom.doc.querySelector('[data-dsh-ur-twin-thumb]').parentNode, column, '插槽也要自愈')

    handle.dispose()
    assert.equal(dom.doc.querySelector('[data-dsh-ur-twin-thumb]'), null, 'dispose 必须移除插槽')
  } finally {
    handle.dispose()
  }
})

/* ================================================================== *
 * 静态守卫：只经注入的 doc 使用 DOM（Ruling 31 硬要求）
 * ================================================================== */

test('guard: sidebar-entry.js 不得直接使用全局 document 的 DOM API', async () => {
  const src = await readFile(new URL('../src/client/sidebar-entry.js', import.meta.url), 'utf8')
  // 先去掉注释：文件头与 JSDoc 里会**引用**真实锚点写法（那是文档，不是调用）。
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  const bare =
    /(?:^|[^.\w$])document\s*\.\s*(querySelector|querySelectorAll|createElement|addEventListener|removeEventListener|body|documentElement|head)/
  assert.equal(bare.test(code), false, '发现直接使用全局 document 的调用：必须改成注入的 doc')
})
