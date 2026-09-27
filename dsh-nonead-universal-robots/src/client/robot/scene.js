/**
 * src/client/robot/scene.js — three.js 场景/相机/光照/OrbitControls 装配。
 *
 * 与 `loader.js` 分离的原因：本模块只负责"渲染容器"，模型装配与 FK 归 loader / twin-panel。
 *
 * ## 测试缺口（如实标注）
 * `WebGLRenderer` 需要真实的 WebGL 上下文，**Node 下无法构造**，故本模块**不做单测**
 * （单测只能覆盖到 import 层面）。视觉效果与交互（旋转/缩放/光照/GridHelper）交由
 * Task 8 的 GUI 手动验收 + Task 9 侧边栏入口验证。
 * 参考：`node --test test/*.test.mjs` 不含本模块用例。
 */

import { Scene, PerspectiveCamera, WebGLRenderer, DirectionalLight, AmbientLight, GridHelper } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

/**
 * 在给定 canvas 上装配渲染场景。
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {{renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera,
 *            controls: OrbitControls, resize: () => void, render: () => void, dispose: () => void}}
 */
export function createScene(canvas) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true })
  const scene = new Scene()
  const camera = new PerspectiveCamera(45, 1, 0.01, 100)
  camera.position.set(0.8, 0.6, 0.8)

  scene.add(new AmbientLight(0xffffff, 0.8))
  const dir = new DirectionalLight(0xffffff, 1.2)
  dir.position.set(1, 2, 1)
  scene.add(dir)
  scene.add(new GridHelper(2, 20, 0x334455, 0x223344))

  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  controls.target.set(0, 0, 0.3)

  /** 跟随 canvas 的 CSS 尺寸；尺寸为 0（面板收起）时直接跳过，避免 aspect=NaN。 */
  function resize() {
    const { clientWidth: w, clientHeight: h } = canvas
    if (w === 0 || h === 0) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }

  /** 每帧调用：阻尼更新 + 渲染。 */
  function render() {
    controls.update()
    renderer.render(scene, camera)
  }

  /** 释放控制器与渲染器（GPU 资源）；模型侧资源由 loader 的 dispose 负责。 */
  function dispose() {
    controls.dispose()
    renderer.dispose()
  }

  return { renderer, scene, camera, controls, resize, render, dispose }
}
