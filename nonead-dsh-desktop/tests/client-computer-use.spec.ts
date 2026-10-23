/** A refused Computer Use change must never look like a successful toggle. */
import { afterEach, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'

const hooks = vi.hoisted(() => ({ effects: [] as (() => unknown)[], states: [] as unknown[], cursor: 0 }))
vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useEffect: (effect: () => unknown) => { hooks.effects.push(effect) },
  useRef: (current: unknown) => ({ current }),
  useState: (initial: unknown) => {
    const index = hooks.cursor++
    if (!(index in hooks.states)) hooks.states[index] = initial
    return [hooks.states[index], (next: unknown) => {
      hooks.states[index] = typeof next === 'function' ? next(hooks.states[index]) : next
    }]
  },
}))
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({ Button: 'button', StateDot: 'span', Switch: 'button', Toast: 'div' }))
vi.mock('../src/client/permissions.tsx', () => ({ DesktopPermissionsButton: () => null, PermissionDetails: () => null }))
import { ComputerUseSettings } from '../src/client/computer-use.tsx'

type Element = ReactElement<Record<string, any>>
const nodes = (value: unknown): Element[] => Array.isArray(value) ? value.flatMap(nodes)
  : value && typeof value === 'object' && 'props' in value
    ? [value as Element, ...nodes((value as Element).props.children)] : []
afterEach(() => { hooks.effects = []; hooks.states = []; hooks.cursor = 0; vi.unstubAllGlobals() })

function context(setPluginEnabled: (entryId: string, enabled: boolean) => unknown) {
  return {
    remote: { $on: () => () => {}, pluginManager: {
      listPlugins: async () => ({ ok: true, value: [{ entryId: 'computer-use', moduleName: '@deepseek-ai/dsh-experimental-computer-use-cua-driver-native', enabled: false, fiberPhase: 'idle' }] }),
      setPluginEnabled,
    } },
    on: () => () => {},
  } as never
}

it.each(['failed', 'cancelled'] as const)('reports a %s change instead of silently reverting the switch', async application => {
  vi.stubGlobal('window', { desktopNext: undefined })
  const setPluginEnabled = vi.fn(async () => ({ ok: true, value: { application, error: { diagnostic: `refused: ${application}` } } }))
  hooks.cursor = 0
  ComputerUseSettings({ context: context(setPluginEnabled), zh: true })
  hooks.effects[1]!()
  await vi.waitFor(() => expect(hooks.states[1]).toMatchObject({ entryId: 'computer-use' }))
  hooks.cursor = 0
  const switchNode = nodes(ComputerUseSettings({ context: context(setPluginEnabled), zh: true })).find(node => node.type === 'button' && node.props.role === undefined && typeof node.props.onChange === 'function')
  expect(switchNode).toBeDefined()
  switchNode!.props.onChange(true)
  await vi.waitFor(() => expect(setPluginEnabled).toHaveBeenCalledExactlyOnceWith('computer-use', true))
  // The switch keeps the previous `enabled` value, so without a visible failure the user would believe
  // the change was applied; the sibling market and remote-control controls report the same outcome.
  await vi.waitFor(() => {
    hooks.cursor = 0
    const texts = nodes(ComputerUseSettings({ context: context(setPluginEnabled), zh: true })).map(node => node.props.text)
    expect(texts).toContain(`refused: ${application}`)
  })
})
