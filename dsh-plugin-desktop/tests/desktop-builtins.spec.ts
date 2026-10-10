/**
 * `src/desktop-builtins.ts` 的单测：产品内置插件的「已移除」状态。
 *
 * 重点覆盖三类容易出错的地方：
 *   1. **严格解析** —— 多字段/少字段/版本不对/元素非法都必须拒绝，而不是静默接受；
 *   2. **fail-safe** —— 状态文件损坏、不存在、路径非法时一律回退"未移除"，
 *      不能因为一个坏 JSON 就让内置插件在启动时凭空消失；
 *   3. **幂等** —— 重复移除/重复恢复都不报错，且恢复后状态干净。
 */

import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it } from 'vitest'

import {
  DesktopBuiltinsError,
  DesktopBuiltinsService,
  REMOVABLE_BUILTIN_NAMES,
  REMOVABLE_BUILTIN_PLUGINS,
  assertDesktopBuiltinsStatePath,
  desktopBuiltinsStatePath,
  omitRemovedBuiltinPatches,
  parseDesktopBuiltinsState,
  readRemovedDesktopBuiltins,
  setDesktopBuiltinRemoved,
} from '../src/desktop-builtins.ts'

const TARGET = 'dsh-nonead-universal-robots'

const roots: string[] = []

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-desktop-builtins-'))
  roots.push(root)
  return root
}

/** 建出 `<root>/plugin-management/builtins.json` 并写入给定内容。 */
function makeState(root: string, content: string): string {
  const directory = join(root, 'plugin-management')
  mkdirSync(directory, { recursive: true })
  const statePath = join(directory, 'builtins.json')
  writeFileSync(statePath, content)
  return statePath
}

const validPath = (root: string) => join(root, 'plugin-management', 'builtins.json')

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop()
    if (root !== undefined) rmSync(root, { recursive: true, force: true })
  }
})

describe('可移除内置插件清单', () => {
  it('只收 UR 机器人插件，且每个条目都带启动器 row id', () => {
    expect(REMOVABLE_BUILTIN_PLUGINS.map(plugin => plugin.packageName)).toEqual([TARGET])
    for (const plugin of REMOVABLE_BUILTIN_PLUGINS) {
      expect(plugin.rowId).toBe('nonead-universal-robots')
    }
    expect(REMOVABLE_BUILTIN_NAMES.has(TARGET)).toBe(true)
    // 品牌皮肤与桌面本体绝不能进这份清单：前者继续由启动器强挂，后者去掉窗口起不来。
    expect(REMOVABLE_BUILTIN_NAMES.has('dsh-nonead-client-skin')).toBe(false)
    expect(REMOVABLE_BUILTIN_NAMES.has('dsh-plugin-desktop')).toBe(false)
  })
})

describe('状态路径校验', () => {
  it('只接受 <userData>/plugin-management/builtins.json', () => {
    const root = makeRoot()
    expect(() => assertDesktopBuiltinsStatePath(validPath(root))).not.toThrow()
    expect(desktopBuiltinsStatePath(root)).toBe(validPath(root))

    for (const bad of [
      join(root, 'plugin-management', 'state.json'),
      join(root, 'builtins.json'),
      join(root, 'other', 'builtins.json'),
      'relative/builtins.json',
      '',
    ]) {
      expect(() => assertDesktopBuiltinsStatePath(bad)).toThrow()
    }
    expect(() => desktopBuiltinsStatePath('relative-dir')).toThrow()
  })
})

describe('严格解析', () => {
  it('接受合法的版本 1 文档，并对 removed 排序去重', () => {
    const parsed = parseDesktopBuiltinsState({ version: 1, removed: [TARGET, 'b-plugin', TARGET] })
    expect(parsed).toEqual({ version: 1, removed: ['b-plugin', TARGET] })
  })

  it('拒绝任何多字段/少字段/未知版本', () => {
    expect(() => parseDesktopBuiltinsState(null)).toThrow()
    expect(() => parseDesktopBuiltinsState([])).toThrow()
    expect(() => parseDesktopBuiltinsState({ removed: [] })).toThrow()
    expect(() => parseDesktopBuiltinsState({ version: 1 })).toThrow()
    expect(() => parseDesktopBuiltinsState({ version: 2, removed: [] })).toThrow()
    // 多出一个字段就拒绝：状态文件由产品独占，出现陌生字段说明被别的东西改过。
    expect(() => parseDesktopBuiltinsState({ version: 1, removed: [], extra: true })).toThrow()
  })

  it('拒绝非法的 removed 内容', () => {
    expect(() => parseDesktopBuiltinsState({ version: 1, removed: 'x' })).toThrow()
    expect(() => parseDesktopBuiltinsState({ version: 1, removed: [''] })).toThrow()
    expect(() => parseDesktopBuiltinsState({ version: 1, removed: ['../escape'] })).toThrow()
    expect(() => parseDesktopBuiltinsState({ version: 1, removed: [42] })).toThrow()
    expect(() => parseDesktopBuiltinsState({ version: 1, removed: new Array(65).fill('a') })).toThrow()
  })
})

describe('读失败即「未移除」（fail-safe）', () => {
  it('文件不存在时返回空集', () => {
    const root = makeRoot()
    expect([...readRemovedDesktopBuiltins(validPath(root))]).toEqual([])
  })

  it('内容损坏、版本不对、字段非法时都返回空集而不是抛错', () => {
    for (const content of [
      '{ not json',
      JSON.stringify({ version: 2, removed: [TARGET] }),
      JSON.stringify({ version: 1, removed: [TARGET], extra: 1 }),
      JSON.stringify({ version: 1, removed: 'nope' }),
    ]) {
      const root = makeRoot()
      const statePath = makeState(root, content)
      expect(() => readRemovedDesktopBuiltins(statePath)).not.toThrow()
      expect([...readRemovedDesktopBuiltins(statePath)]).toEqual([])
    }
  })

  it('路径非法时返回空集而不是抛错', () => {
    expect([...readRemovedDesktopBuiltins('relative/builtins.json')]).toEqual([])
  })

  it('读得到正常写入的移除记录', async () => {
    const root = makeRoot()
    await setDesktopBuiltinRemoved(validPath(root), TARGET, true)
    expect([...readRemovedDesktopBuiltins(validPath(root))]).toEqual([TARGET])
  })
})

describe('移除 / 恢复', () => {
  it('移除后记录在案，恢复后状态干净，且都幂等', async () => {
    const root = makeRoot()
    const statePath = validPath(root)

    await setDesktopBuiltinRemoved(statePath, TARGET, true)
    await setDesktopBuiltinRemoved(statePath, TARGET, true) // 重复移除不得报错
    expect([...readRemovedDesktopBuiltins(statePath)]).toEqual([TARGET])

    await setDesktopBuiltinRemoved(statePath, TARGET, false)
    await setDesktopBuiltinRemoved(statePath, TARGET, false) // 重复恢复不得报错
    expect([...readRemovedDesktopBuiltins(statePath)]).toEqual([])
  })

  it('拒绝不在清单里的包名（品牌皮肤、桌面本体、任意名字）', async () => {
    const root = makeRoot()
    const statePath = validPath(root)
    for (const name of ['dsh-nonead-client-skin', 'dsh-plugin-desktop', 'evil', '../escape', '']) {
      await expect(setDesktopBuiltinRemoved(statePath, name, true)).rejects.toThrow()
    }
  })

  it('先移除、再手工把文件写坏，读取退回空集（内置插件照常可用）', async () => {
    const root = makeRoot()
    const statePath = validPath(root)
    await setDesktopBuiltinRemoved(statePath, TARGET, true)
    writeFileSync(statePath, '{ 坏掉的 JSON')
    expect([...readRemovedDesktopBuiltins(statePath)]).toEqual([])
  })
})

describe('从启动器 patch 文档里摘掉被移除的内置插件', () => {
  /** 与真实 `cordis.patch.yml` 同形状：顶层对象、`insert` 是行数组。 */
  const makePatches = () => [
    {
      insert: [
        { id: 'desktop-shell', name: 'dsh-plugin-desktop' },
        { id: 'nonead-universal-robots', name: TARGET, config: { pythonBin: 'python' } },
        { id: 'nonead-client-skin', name: 'dsh-nonead-client-skin' },
      ],
    },
    { id: 'web-runtime', config: { openBrowser: false } },
  ]

  it('没有任何移除记录时原样返回入参（同一引用）—— 默认路径零变化', () => {
    const patches = makePatches()
    expect(omitRemovedBuiltinPatches(patches, new Set())).toBe(patches)
  })

  it('移除记录与文档无交集时同样返回入参（同一引用）', () => {
    const patches = makePatches()
    expect(omitRemovedBuiltinPatches(patches, new Set(['some-other-plugin']))).toBe(patches)
  })

  it('命中时只摘掉那一行，其余行与其它 patch 项原样保留', () => {
    const patches = makePatches()
    const result = omitRemovedBuiltinPatches(patches, new Set([TARGET]))
    expect(result).not.toBe(patches)
    const insert = (result[0] as { insert: { name: string }[] }).insert
    expect(insert.map(entry => entry.name)).toEqual(['dsh-plugin-desktop', 'dsh-nonead-client-skin'])
    // 品牌皮肤必须留着：它继续由启动器强制挂载。
    expect(insert.some(entry => entry.name === 'dsh-nonead-client-skin')).toBe(true)
    // 第二项（非 insert 形状）不受影响。
    expect(result[1]).toBe(patches[1])
    // 原文档不得被就地改写。
    expect((patches[0] as { insert: unknown[] }).insert).toHaveLength(3)
  })

  it('对畸形输入保持宽容：非对象项、缺 insert、insert 不是数组都不抛错', () => {
    const weird = [
      null,
      'string',
      { insert: 'not-an-array' },
      { insert: [null, 'x', { name: 42 }, { noName: true }] },
    ]
    expect(() => omitRemovedBuiltinPatches(weird as never[], new Set([TARGET]))).not.toThrow()
    // 没有一行能命中 ⇒ 返回入参本身。
    const result = omitRemovedBuiltinPatches(weird as never[], new Set([TARGET]))
    expect(result).toBe(weird)
  })
})

describe('DesktopBuiltinsService：两阶段移除 / 恢复', () => {
  /** 安装锚点指向一个不存在的路径 ⇒ 版本读不到，正好覆盖"读不到就是 null"。 */
  const MISSING_ANCHOR = join(tmpdir(), 'no-such-install', 'package.json')

  async function harness(now?: () => number) {
    const ctx = new Context()
    const statePath = validPath(makeRoot())
    const fiber = ctx.plugin(DesktopBuiltinsService, {
      statePath,
      installAnchor: MISSING_ANCHOR,
      // `exactOptionalPropertyTypes` 下不能显式传 undefined，只能在有值时展开。
      ...(now === undefined ? {} : { now }),
    })
    await fiber // Cordis 的 plugin() 要 await 之后服务才真正挂上
    const service = ctx.get('desktopBuiltins')
    if (service === undefined) throw new Error('desktopBuiltins did not mount')
    return { ctx, fiber, service, statePath }
  }

  const codeOf = (cause: unknown) =>
    cause instanceof DesktopBuiltinsError ? cause.code : undefined

  it('list() 报告清单与状态；版本读不到就是 null（不猜）', async () => {
    const { fiber, service } = await harness()
    const list = service.list()
    expect(list.map(item => item.packageName)).toEqual([TARGET])
    expect(list[0]?.rowId).toBe('nonead-universal-robots')
    expect(list[0]?.status).toBe('active')
    expect(list[0]?.version).toBeNull()
    await fiber.dispose()
  })

  it('移除 → 状态变为 removed；恢复 → 回到 active', async () => {
    const { fiber, service } = await harness()
    const removePreview = service.previewRemove(TARGET)
    expect(removePreview.action).toBe('remove')
    await service.executeRemove(removePreview.previewId)
    expect(service.list()[0]?.status).toBe('removed')

    const restorePreview = service.previewRestore(TARGET)
    expect(restorePreview.action).toBe('restore')
    await service.executeRestore(restorePreview.previewId)
    expect(service.list()[0]?.status).toBe('active')
    await fiber.dispose()
  })

  it('确认是一次性的：同一个 previewId 不能用第二次', async () => {
    const { fiber, service } = await harness()
    const preview = service.previewRemove(TARGET)
    await service.executeRemove(preview.previewId)
    await expect(service.executeRemove(preview.previewId)).rejects.toSatisfy(
      (cause: unknown) => codeOf(cause) === 'preview-expired',
    )
    await fiber.dispose()
  })

  it('确认会过期（注入时钟推进 5 分钟后失效）', async () => {
    let clock = 1_000_000
    const { fiber, service } = await harness(() => clock)
    const preview = service.previewRemove(TARGET)
    clock += 5 * 60 * 1000 + 1
    await expect(service.executeRemove(preview.previewId)).rejects.toSatisfy(
      (cause: unknown) => codeOf(cause) === 'preview-expired',
    )
    // 过期的确认不得写盘。
    expect(service.list()[0]?.status).toBe('active')
    await fiber.dispose()
  })

  it('重复移除、重复恢复、以及清单外的包名都被拒绝', async () => {
    const { fiber, service } = await harness()
    await service.executeRemove(service.previewRemove(TARGET).previewId)

    expect(() => service.previewRemove(TARGET)).toThrowError(
      expect.objectContaining({ code: 'already-removed' }),
    )
    expect(() => service.previewRestore('dsh-nonead-client-skin')).toThrowError(
      expect.objectContaining({ code: 'invalid-target' }),
    )
    expect(() => service.previewRemove('evil')).toThrowError(
      expect.objectContaining({ code: 'invalid-target' }),
    )

    const restored = service.previewRestore(TARGET)
    await service.executeRestore(restored.previewId)
    expect(() => service.previewRestore(TARGET)).toThrowError(
      expect.objectContaining({ code: 'already-active' }),
    )
    await fiber.dispose()
  })

  it('同一时刻只允许一个变更在飞：第二个立即被拒', async () => {
    const { fiber, service } = await harness()
    const a = service.previewRemove(TARGET)
    const b = service.previewRemove(TARGET)
    // 第一个 execute 尚未落盘时，第二个必须被拒而不是并发写同一个文件。
    const first = service.executeRemove(a.previewId)
    await expect(service.executeRemove(b.previewId)).rejects.toSatisfy(
      (cause: unknown) => codeOf(cause) === 'persistence-failed',
    )
    await first
    await fiber.dispose()
  })

  it('服务 dispose 之后再调用一律抛错（不给已失效的 generation 用）', async () => {
    const { fiber, service } = await harness()
    await fiber.dispose()
    expect(() => service.list()).toThrow()
  })
})


