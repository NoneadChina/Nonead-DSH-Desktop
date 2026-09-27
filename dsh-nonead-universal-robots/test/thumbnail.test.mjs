/**
 * test/thumbnail.test.mjs — Task 9：侧边栏缩略 3D 视图（复用同一个 state）。
 *
 * 本环境**没有 DOM 也没有 WebGL**：`sceneFactory` / `modelLoader` / `raf` / `caf` / `now` / `doc` / `fk`
 * 全部注入假实现，因此可以确定地覆盖：
 *   - 挂载后 canvas 进容器、场景创建、**只订阅一次**共享 state（不自建轮询）
 *   - 未连接时**不加载模型**；连接后按型号加载并把 root 加入场景
 *   - 每帧用插值后的关节角写姿态（`applyFK`），断连时把模型移出场景
 *   - 型号变化时重建模型（旧 root 移出、新 root 加入）
 *   - `dispose()` 幂等：退订、停帧、释放场景、移除 canvas、之后再排队的帧不再渲染
 *
 * 运行：node --test test/thumbnail.test.mjs
 * （**不要**用 npm test：当前沙箱下 npm 的 piped stdio 会 spawn EPERM）
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { CANVAS_ATTRIBUTE, THUMB_CAMERA_TARGET, mountThumbnail } from '../src/client/thumbnail.js'

/* ================================================================== *
 * 假件
 * ================================================================== */

function createFakeDoc() {
  return {
    createElement(tag) {
      return {
        tagName: String(tag).toUpperCase(),
        style: {},
        attributes: new Map(),
        parentNode: null,
        clientWidth: 320,
        clientHeight: 132,
        setAttribute(name, value) {
          this.attributes.set(name, String(value))
        },
        getAttribute(name) {
          return this.attributes.has(name) ? this.attributes.get(name) : null
        },
        remove() {
          this.parentNode?.removeChild(this)
        },
      }
    },
  }
}

function createContainer(doc) {
  return {
    ownerDocument: doc,
    style: {},
    children: [],
    appendChild(el) {
      this.children.push(el)
      el.parentNode = this
      return el
    },
    removeChild(el) {
      const i = this.children.indexOf(el)
      if (i >= 0) this.children.splice(i, 1)
      el.parentNode = null
      return el
    },
  }
}

/** 假状态源：只暴露 subscribe / getSnapshot（与 Task 6 的真实 state 同形），并记录订阅数。 */
function createFakeState(initial = {}) {
  const listeners = new Set()
  let snapshot = { connected: false, model: '', q: [], tcp: [], ts: 0, error: null, ...initial }
  return {
    subscribeCount: 0,
    subscribe(listener) {
      this.subscribeCount++
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot: () => snapshot,
    emit(next) {
      snapshot = { ...snapshot, ...next }
      for (const listener of [...listeners]) listener(snapshot)
    },
    listenerCount: () => listeners.size,
  }
}

function createFakeScene(canvas) {
  const scene = {
    canvas,
    children: [],
    resizeCalls: 0,
    renderCalls: 0,
    disposeCalls: 0,
    cameraPosition: null,
    cameraTarget: null,
    add(obj) {
      if (!this.children.includes(obj)) this.children.push(obj)
    },
    remove(obj) {
      const i = this.children.indexOf(obj)
      if (i >= 0) this.children.splice(i, 1)
      return i >= 0
    },
    resize() {
      this.resizeCalls++
    },
    render() {
      this.renderCalls++
    },
    dispose() {
      this.disposeCalls++
    },
    camera: {
      position: { set: (...args) => { scene.cameraPosition = args } },
      lookAt: (...args) => { scene.cameraTarget = args },
    },
    controls: { enabled: true, enableDamping: true },
  }
  return scene
}

/** 假模型句柄：与 Task 7 的 `loadRobotModel` 同形（含 applyFK / dispose 计数）。 */
function createFakeModel(id) {
  const record = { applyFKCalls: [], disposeCalls: 0 }
  const handle = {
    root: { name: `model:${id}` },
    groups: Array.from({ length: 7 }, (_, i) => ({ name: `assemble_${i}` })),
    usedFallback: false,
    record,
    applyFK(result) {
      record.applyFKCalls.push(result)
    },
    dispose() {
      record.disposeCalls++
    },
  }
  return handle
}

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
    cancellations: () => cancellations,
  }
}

/** 让 `ensureModel` 的 promise 链跑完（模型加载是异步的）。 */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

const JOINT_COUNT = 6

function zeros() {
  return new Array(JOINT_COUNT).fill(0)
}

/**
 * 按默认注入项挂载一次，返回所有假件与句柄（每个用例各自独立）。
 */
function mount(overrides = {}) {
  const doc = createFakeDoc()
  const container = createContainer(doc)
  const state = createFakeState()
  const scheduler = createScheduler()
  const scenes = []
  const loads = []
  const cache = new Map()
  const fkCalls = []
  let clockMs = 1000

  const sceneFactory = (canvas) => {
    const scene = createFakeScene(canvas)
    scenes.push(scene)
    return scene
  }
  // 与真实 loader 一样**按型号缓存**句柄（这正是"不得单方 dispose"的原因）。
  const modelLoader = async (id) => {
    loads.push(id)
    const key = String(id).toLowerCase()
    if (!cache.has(key)) cache.set(key, createFakeModel(key))
    return cache.get(key)
  }
  const fk = (kin, q) => {
    fkCalls.push({ kin, q: q.slice() })
    return { links: [], tool0: [] }
  }

  const handle = mountThumbnail({
    container,
    state,
    sceneFactory,
    modelLoader,
    raf: scheduler.raf,
    caf: scheduler.caf,
    now: () => clockMs,
    doc,
    fk,
    ...overrides,
  })

  return {
    doc,
    container,
    state,
    scheduler,
    scenes,
    scene: () => scenes[0],
    loads,
    cache,
    fkCalls,
    handle,
    setClock: (value) => { clockMs = value },
  }
}

/* ================================================================== *
 * 用例 1：挂载（未连接）
 * ================================================================== */

test('挂载：canvas 进容器、创建场景、只订阅一次共享 state；未连接不加载模型', () => {
  const h = mount()
  try {
    assert.equal(h.scenes.length, 1, '必须只创建一个场景')
    assert.equal(h.container.children.length, 1, '容器内应恰好一个 canvas')
    assert.equal(h.container.children[0], h.scene().canvas)
    assert.equal(h.container.children[0].getAttribute(CANVAS_ATTRIBUTE), '', 'canvas 应带标记属性')
    assert.equal(h.state.subscribeCount, 1, '必须订阅共享 state（而不是自建数据源）')
    assert.deepEqual(h.loads, [], '未连接时不得加载模型')
    assert.equal(h.scene().children.length, 0, '未连接时场景里不得有模型')
    assert.equal(h.scene().controls.enabled, false, '缩略图无交互：控制器必须关闭')
    assert.equal(h.scene().controls.enableDamping, false, '无交互：关闭阻尼')
    assert.deepEqual(h.scene().cameraPosition, [0.62, 0.42, 0.66], '相机必须固定到缩略机位')
    assert.deepEqual(h.scene().cameraTarget, THUMB_CAMERA_TARGET)
    assert.ok(h.scene().resizeCalls >= 1, '挂载时应按容器尺寸 resize 一次')
  } finally {
    h.handle.dispose()
  }
})

/* ================================================================== *
 * 用例 2：连接后加载模型 + 每帧插值写姿态
 * ================================================================== */

test('连接后按型号加载模型、root 入场景，每帧用插值关节角写姿态', async () => {
  const h = mount()
  try {
    h.setClock(1000)
    h.state.emit({ connected: true, model: 'UR3', q: zeros(), tcp: zeros(), ts: 1000 })
    await settle()

    assert.deepEqual(h.loads, ['UR3'], '必须用快照里的型号调用 modelLoader')
    const model = h.cache.get('ur3')
    assert.equal(h.scene().children.includes(model.root), true, '模型 root 必须进场景')

    h.scheduler.flush()
    assert.ok(h.fkCalls.length >= 1, '每帧必须跑 FK')
    assert.ok(model.record.applyFKCalls.length >= 1, '每帧必须把 FK 结果写进模型（applyFK）')
    assert.equal(h.fkCalls.at(-1).kin.links.length, 6, '必须用内联的 kinematics 表（6 段链）')
    assert.deepEqual(h.fkCalls.at(-1).q, zeros())

    // 第二帧快照：时钟走到两帧中点 ⇒ 关节角必须插值到一半（共享 FK 状态的平滑跟随）
    h.setClock(1500)
    h.state.emit({
      connected: true,
      model: 'UR3',
      q: new Array(JOINT_COUNT).fill(1),
      tcp: zeros(),
      ts: 2000,
    })
    h.scheduler.flush()
    const interpolated = h.fkCalls.at(-1).q
    for (const value of interpolated) {
      assert.ok(Math.abs(value - 0.5) < 1e-9, `两帧中点应插值到 0.5，实际 ${value}`)
    }
  } finally {
    h.handle.dispose()
  }
})

/* ================================================================== *
 * 用例 3：断连 / 重连
 * ================================================================== */

test('断连时把模型移出场景且不再写姿态；重连复用已加载模型（不重复加载）', async () => {
  const h = mount()
  try {
    h.state.emit({ connected: true, model: 'UR3', q: zeros(), ts: 1000 })
    await settle()
    const model = h.cache.get('ur3')
    assert.equal(h.scene().children.includes(model.root), true)

    h.state.emit({ connected: false, error: 'robot offline' })
    assert.equal(h.scene().children.includes(model.root), false, '断连必须把模型移出场景')
    assert.deepEqual(h.loads, ['UR3'], '断连不得触发加载')

    const fkBefore = h.fkCalls.length
    h.scheduler.flush()
    assert.equal(h.fkCalls.length, fkBefore, '无可见模型时不得写姿态')

    h.state.emit({ connected: true, model: 'UR3', q: zeros(), ts: 2000 })
    await settle()
    assert.equal(h.scene().children.includes(model.root), true, '重连必须复用已加载模型')
    assert.deepEqual(h.loads, ['UR3'], '重连不得重复加载')
  } finally {
    h.handle.dispose()
  }
})

/* ================================================================== *
 * 用例 4：型号变化 ⇒ 重建模型
 * ================================================================== */

test('型号变化时重建模型：旧 root 移出场景、新 root 加入', async () => {
  const h = mount()
  try {
    h.state.emit({ connected: true, model: 'UR3', q: zeros(), ts: 1000 })
    await settle()
    const oldModel = h.cache.get('ur3')
    assert.equal(h.scene().children.includes(oldModel.root), true)

    h.state.emit({ connected: true, model: 'UR5E', q: zeros(), ts: 2000 })
    await settle()
    const newModel = h.cache.get('ur5e')
    assert.deepEqual(h.loads, ['UR3', 'UR5E'], '型号变化必须重新加载对应型号')
    assert.equal(h.scene().children.includes(newModel.root), true, '新模型必须进场景')
    assert.equal(h.scene().children.includes(oldModel.root), false, '旧模型必须移出场景')
    assert.equal(h.handle.getModelId(), 'ur5e')
    assert.equal(h.handle.isModelVisible(), true)
  } finally {
    h.handle.dispose()
  }
})

/* ================================================================== *
 * 用例 5：dispose（幂等 + 无订阅/帧泄漏）
 * ================================================================== */

test('dispose() 幂等：退订、停帧、释放场景、移除 canvas，之后排队的帧不再渲染', async () => {
  const h = mount()
  try {
    h.state.emit({ connected: true, model: 'UR3', q: zeros(), ts: 1000 })
    await settle()
    h.scheduler.flush()

    const model = h.cache.get('ur3')
    const scene = h.scene()
    const fkBefore = h.fkCalls.length
    const renderBefore = scene.renderCalls

    h.handle.dispose()

    assert.equal(h.state.listenerCount(), 0, '不得残留 state 订阅（订阅泄漏）')
    assert.ok(h.scheduler.cancellations().length >= 1, '必须 cancel 掉已排队的帧')
    assert.equal(scene.disposeCalls, 1, '必须释放场景（WebGL 资源）')
    assert.equal(h.container.children.length, 0, '必须移除 canvas')
    assert.equal(scene.children.includes(model.root), false, '模型必须移出场景')
    assert.equal(
      model.record.disposeCalls,
      1,
      '必须释放**自己那一份**模型引用（Ruling 36）：loadRobotModel 每次调用返回独立释放句柄，' +
        '只有引用归零才真正释放资源；不释放会导致引用计数只增不减、模型永不回收',
    )
    // 幂等：再次 dispose 不得重复释放（引用计数不能被多扣）
    h.handle.dispose()
    assert.equal(model.record.disposeCalls, 1, 'dispose 幂等：不得重复释放引用')

    // 已排队的帧回调在 dispose 之后不得再渲染或写姿态
    h.scheduler.flush()
    assert.equal(h.fkCalls.length, fkBefore, 'dispose 之后不得再写姿态')
    assert.equal(scene.renderCalls, renderBefore, 'dispose 之后不得再渲染')

    h.handle.dispose() // 幂等：重复调用不得抛错
    assert.equal(scene.disposeCalls, 1, '重复 dispose 不得二次释放场景')
  } finally {
    h.handle.dispose()
  }
})

test('dispose() 在未连接（没有模型）时也安全，且无场景时（sceneFactory 抛错）不抛错', () => {
  const h = mount()
  h.handle.dispose()
  h.handle.dispose()
  assert.equal(h.state.listenerCount(), 0)

  const doc = createFakeDoc()
  const container = createContainer(doc)
  const state = createFakeState()
  const scheduler = createScheduler()
  const handle = mountThumbnail({
    container,
    state,
    doc,
    sceneFactory: () => {
      throw new Error('no webgl in node')
    },
    modelLoader: async () => {
      throw new Error('should not be called')
    },
    raf: scheduler.raf,
    caf: scheduler.caf,
  })
  try {
    assert.equal(container.children.length, 1, 'canvas 仍然要挂上（无 WebGL 时降级）')
    state.emit({ connected: true, model: 'UR3', q: zeros(), ts: 1 })
    scheduler.flush() // 无场景：不得抛错
    assert.doesNotThrow(() => handle.dispose())
  } finally {
    handle.dispose()
  }
})

/* ================================================================== *
 * 静态守卫：不得自建轮询（"复用同一个 state"的硬约束）
 * ================================================================== */

test('guard: thumbnail.js 不得自建轮询（无 createTwinState / fetch / setInterval）', async () => {
  const src = await readFile(new URL('../src/client/thumbnail.js', import.meta.url), 'utf8')
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  assert.equal(/\bcreateTwinState\b/.test(code), false, '缩略图不得自建状态源')
  assert.equal(/\bsetInterval\s*\(/.test(code), false, '缩略图不得自建定时轮询')
  assert.equal(/\bsetTimeout\s*\(/.test(code), false, '缩略图不得自建定时轮询')
  assert.equal(/\bfetch\s*\(/.test(code), false, '缩略图不得直接取数')
  assert.equal(/TWIN_STATE_PATH/.test(code), false, '缩略图不得直接引用 host 路由')
})
