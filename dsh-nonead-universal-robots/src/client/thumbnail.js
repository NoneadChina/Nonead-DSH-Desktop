/**
 * src/client/thumbnail.js — 侧边栏内嵌缩略 3D 视图。
 *
 * ## 设计约束（设计文档 §4.2 / 计划 Task 9 Step 2）
 * - **复用同一个 `state`**（Task 6 的轮询数据源）：缩略图**不得**另起轮询，
 *   只 `state.subscribe(...)` 收快照，与大视图共享同一份 FK 状态。
 * - **无交互**：`OrbitControls` 关闭（`controls.enabled = false`）、相机固定，
 *   不接受用户输入，不改变共享状态。
 * - **未连接不加模型**：`connected !== true` 时不调用 `modelLoader`，并把已有模型移出场景。
 * - 尺寸跟随侧边栏容器（每帧检测 `clientWidth/clientHeight` 变化才 `resize()`）。
 *
 * ## 可测性（Ruling 31）
 * 本环境**没有 DOM 也没有 WebGL**：`sceneFactory` / `modelLoader` / `raf` / `caf` / `now`
 * 全部可注入（缺省保持真实行为不变），`doc` 可显式注入（缺省 `container.ownerDocument`）。
 * `test/thumbnail.test.mjs` 用假 scene / 假 loader / 假 state 覆盖
 * 订阅与退订、未连接不加模型、断连移出模型、dispose 幂等。
 *
 * ## 模型句柄的释放（Ruling 36）
 * - `loadRobotModel` 每次调用返回**独立的释放句柄**（loader 内部按型号引用计数），
 *   缩略图与大视图共享同一份几何但各持一份引用；任一方 `dispose()` **不会**影响另一方，
 *   只有引用归零才真正释放 GPU 资源。因此本模块在换型号/卸载时**必须**释放自己那一份，
 *   否则引用计数只增不减、模型永不回收。
 * 运动学链同样内联自 `assets/kinematics.json`（构建期打进 bundle，Ruling 19/22）。
 */

import kinematicsJson from '../../assets/kinematics.json' with { type: 'json' }

import { createScene } from './robot/scene.js'
import { loadRobotModel } from './robot/loader.js'
import { fkChain } from './robot/fk.js'
import { interpolateAt } from './robot/interpolate.js'

/** 缩略图 canvas 的标记属性。 */
export const CANVAS_ATTRIBUTE = 'data-dsh-ur-twin-thumb-canvas'

/** 相机固定机位（缩略图无交互，避免依赖 OrbitControls 的 target/阻尼）。 */
export const THUMB_CAMERA_POSITION = [0.62, 0.42, 0.66]

/** 相机注视点（大致取臂展中部，让整臂落在画面里）。 */
export const THUMB_CAMERA_TARGET = [0, 0, 0.25]

const CANVAS_STYLE = { display: 'block', width: '100%', height: '100%' }

function registry() {
  return typeof globalThis === 'undefined' ? undefined : globalThis
}

function resolveRaf(provided) {
  if (typeof provided === 'function') return provided
  const fromGlobal = registry()?.requestAnimationFrame
  return typeof fromGlobal === 'function' ? (cb) => fromGlobal(cb) : undefined
}

function resolveCaf(provided) {
  if (typeof provided === 'function') return provided
  const fromGlobal = registry()?.cancelAnimationFrame
  return typeof fromGlobal === 'function' ? (id) => fromGlobal(id) : undefined
}

function resolveNow(provided) {
  if (typeof provided === 'function') return provided
  const perf = registry()?.performance
  return typeof perf?.now === 'function' ? () => perf.now() : () => Date.now()
}

function setStyle(el, props) {
  if (!el || !el.style) return
  for (const key of Object.keys(props)) el.style[key] = props[key]
}

/** 取型号对应的运动学链（键是小写型号 id，与 `assets/kinematics.json` 一致）。 */
function kinematicsFor(table, modelId) {
  if (!table || !modelId) return undefined
  const key = String(modelId).toLowerCase()
  const kin = table[key]
  return kin ?? undefined
}

/** 造 canvas；无可用文档时退回一个形状兼容的空壳（Node 下的默认路径不会用它）。 */
function createCanvas(doc) {
  if (doc && typeof doc.createElement === 'function') {
    const canvas = doc.createElement('canvas')
    canvas.setAttribute(CANVAS_ATTRIBUTE, '')
    setStyle(canvas, CANVAS_STYLE)
    return canvas
  }
  return {
    width: 0,
    height: 0,
    clientWidth: 0,
    clientHeight: 0,
    style: {},
    setAttribute() {},
    addEventListener() {},
    removeEventListener() {},
    remove() {},
  }
}

/**
 * 在侧边栏容器里挂载缩略 3D 视图。
 *
 * @param {object} options
 * @param {Element} options.container 宿主容器（侧边栏插槽）
 * @param {{getSnapshot: () => object, subscribe: (fn: Function) => Function}} options.state
 *        共享的只读状态源（Task 6）；缩略图**不自建轮询**
 * @param {(canvas: Element) => object} [options.sceneFactory=createScene] 场景工厂（注入点）
 * @param {(modelId: string) => Promise<object>} [options.modelLoader=loadRobotModel] 模型加载（注入点）
 * @param {(cb: Function) => any} [options.raf=globalThis.requestAnimationFrame] 帧调度（注入点）
 * @param {(id: any) => void} [options.caf=globalThis.cancelAnimationFrame] 帧取消（注入点）
 * @param {() => number} [options.now=() => performance.now()] 时钟（注入点）
 * @param {Document} [options.doc] 目标文档（缺省 `container.ownerDocument`）
 * @param {object} [options.kinematics=assets/kinematics.json] 运动学表（注入点）
 * @param {Function} [options.fk=fkChain] FK 实现（注入点）
 * @returns {{dispose: () => void, isModelVisible: () => boolean, getModelId: () => string}}
 *          幂等的卸载句柄
 */
export function mountThumbnail({
  container,
  state,
  sceneFactory = createScene,
  modelLoader = loadRobotModel,
  raf,
  caf,
  now,
  doc,
  kinematics = kinematicsJson,
  fk = fkChain,
} = {}) {
  const ownerDoc = doc ?? container?.ownerDocument ?? registry()?.document
  const schedule = resolveRaf(raf)
  const cancel = resolveCaf(caf)
  const clock = resolveNow(now)

  let disposed = false
  let scheduled = false
  let frame
  let scene = null
  let canvas = null
  let model = null // Task 7 的模型句柄；由 releaseModel() 释放**本模块的那一份引用**（Ruling 36）
  let modelId = ''
  let modelVisible = false
  let loadToken = 0
  let lastWidth = -1
  let lastHeight = -1
  let prevSample = null
  let curSample = null
  let unsubscribe = () => {}

  /* ---------------- DOM 与场景 ---------------- */

  canvas = createCanvas(ownerDoc)
  container?.appendChild?.(canvas)

  if (canvas) {
    try {
      scene = sceneFactory(canvas) ?? null
    } catch {
      scene = null // 无 WebGL（Node）时降级为"只有状态、没有 3D"，绝不抛错
    }
  }

  if (scene) {
    if (scene.controls) {
      // 缩略图**无交互**：关掉控制器，相机由本模块固定。
      scene.controls.enabled = false
      if ('enableDamping' in scene.controls) scene.controls.enableDamping = false
    }
    if (typeof scene.camera?.position?.set === 'function') {
      scene.camera.position.set(...THUMB_CAMERA_POSITION)
      scene.camera.lookAt?.(...THUMB_CAMERA_TARGET)
    }
    scene.resize?.()
  }

  /* ---------------- 模型 ---------------- */

  const hideModel = () => {
    if (model && scene) {
      try {
        scene.remove?.(model.root)
      } catch {
        /* 忽略 */
      }
    }
    modelVisible = false
  }

  /**
   * 释放本模块持有的那一份模型引用（Ruling 36 引用计数）。
   *
   * 早期实现**故意不** dispose，因为 `loadRobotModel` 的句柄当时是共享对象、单方 dispose
   * 会释放掉中栏大视图正在渲染的 geometry/material。加了引用计数后，每次 `loadRobotModel`
   * 调用返回**独立的释放句柄**，只有引用归零才真正释放资源 —— 因此缩略图**必须**释放自己这一份，
   * 否则引用计数只增不减，切型号/卸载时永不回收。
   */
  const releaseModel = () => {
    const handle = model
    model = null
    modelId = ''
    try {
      handle?.dispose?.()
    } catch {
      /* 释放失败不应影响卸载流程 */
    }
  }

  const ensureModel = (id) => {
    if (!scene || !id) return
    // 型号比较用小写键（`loadRobotModel` 内部同样小写化；快照里通常是 `UR3` 这种原始写法）。
    const key = String(id).toLowerCase()
    if (model && modelId === key) {
      if (!modelVisible) {
        scene.add?.(model.root)
        modelVisible = true
      }
      return
    }
    const token = ++loadToken
    Promise.resolve()
      .then(() => modelLoader(id))
      .then((handle) => {
        // dispose 之后或已被更新的型号取代：把这次刚取得的引用**还回去**（Ruling 36），
        // 否则引用计数会漏掉一次、模型永不回收。
        if (disposed || token !== loadToken || !handle?.root) {
          try { handle?.dispose?.() } catch { /* 忽略 */ }
          return
        }
        if (model) {
          hideModel()
          releaseModel()
        }
        model = handle
        modelId = key
        scene.add?.(handle.root)
        modelVisible = true
      })
      .catch(() => {
        // 加载失败由 loader 内部回退（Task 7），这里只需不让异常逃逸
      })
  }

  /* ---------------- 快照 → 采样对 ---------------- */

  const applySnapshot = (snapshot) => {
    if (disposed || !snapshot) return
    if (snapshot.connected === true) {
      const id = String(snapshot.model ?? '')
      if (id) ensureModel(id)
      if (Array.isArray(snapshot.q) && snapshot.q.length === 6) {
        const ts = Number.isFinite(snapshot.ts) ? snapshot.ts : clock()
        prevSample = curSample ?? { q: snapshot.q.slice(), ts }
        curSample = { q: snapshot.q.slice(), ts }
      }
    } else {
      // 未连接：不加模型（也不保留姿态采样，避免重连后跨断连插值）。
      hideModel()
      prevSample = null
      curSample = null
    }
  }

  /* ---------------- 渲染循环 ---------------- */

  const applyPose = () => {
    if (!model || !modelVisible) return
    const kin = kinematicsFor(kinematics, modelId)
    if (!kin) return
    const q = prevSample && curSample ? interpolateAt(prevSample, curSample, clock()) : curSample?.q
    if (!Array.isArray(q) || q.length !== 6) return
    try {
      model.applyFK?.(fk(kin, q))
    } catch {
      /* 姿态计算异常不得打断渲染循环 */
    }
  }

  const tick = () => {
    scheduled = false
    frame = undefined
    if (disposed) return
    if (scene) {
      if (canvas) {
        // 尺寸跟随侧边栏容器：只在真的变了才 resize（scene.js 对 0 尺寸自会跳过）。
        const w = canvas.clientWidth
        const h = canvas.clientHeight
        if (w !== lastWidth || h !== lastHeight) {
          lastWidth = w
          lastHeight = h
          scene.resize?.()
        }
      }
      applyPose()
      scene.render?.()
    }
    scheduleFrame()
  }

  function scheduleFrame() {
    if (disposed || scheduled || typeof schedule !== 'function') return
    scheduled = true
    frame = schedule(tick)
  }

  const cancelFrame = () => {
    if (frame !== undefined && typeof cancel === 'function') {
      try {
        cancel(frame)
      } catch {
        /* 忽略 */
      }
    }
    frame = undefined
    scheduled = false
  }

  /* ---------------- 启动 ---------------- */

  if (typeof state?.subscribe === 'function') {
    unsubscribe = state.subscribe(applySnapshot)
  }
  applySnapshot(typeof state?.getSnapshot === 'function' ? state.getSnapshot() : null)
  scheduleFrame()

  return {
    isModelVisible: () => modelVisible,
    getModelId: () => modelId,
    dispose() {
      if (disposed) return
      disposed = true
      cancelFrame()
      try {
        unsubscribe()
      } catch {
        /* 忽略 */
      }
      unsubscribe = () => {}
      loadToken++ // 让仍在飞行中的加载结果作废
      hideModel()
      releaseModel()
      modelId = ''
      try {
        scene?.dispose?.()
      } catch {
        /* 忽略 */
      }
      scene = null
      try {
        canvas?.remove?.()
      } catch {
        /* 忽略 */
      }
      canvas = null
    },
  }
}
