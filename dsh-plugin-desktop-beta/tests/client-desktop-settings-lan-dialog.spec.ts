// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DesktopSettingsSection,
  type DesktopSettingsSectionProps,
} from '../src/client/DesktopSettingsSection.tsx'
import { zh } from '../src/client/desktop-settings-locales.ts'

/*
 * The LAN confirmation is the one Desktop settings dialog that is not built on
 * the shared `Dialog` primitive, so it owns its focus and Escape handling. It
 * declares `aria-modal="true"`: a keyboard or screen-reader user must land
 * inside it, must not tab into the page behind it, must be able to cancel with
 * Escape, and must get focus back where it came from.
 */

let root: Root | undefined
let container: HTMLDivElement | undefined

function scope(value: unknown, set: (field: string, next: unknown) => Promise<void> = async () => {}) {
  const snapshot = { status: 'ready', writable: true, value }
  return { getSnapshot: () => snapshot, subscribe: () => () => {}, set }
}

async function mount(): Promise<{
  readonly host: HTMLDivElement
  readonly setProperty: ReturnType<typeof vi.fn>
}> {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  const setProperty = vi.fn(async () => {})
  const props = {
    t: (key: keyof typeof zh) => zh[key],
    api: {
      read: async () => ({
        current: 'desktop',
        profiles: [],
        aa: { requested: false, effective: false },
        market: { requested: 'disabled', effective: 'disabled', legacyDefaulted: false },
        web: { localUrl: '', lanUrls: [], lanState: 'inactive', lanError: null, lanCaFingerprint: null, lanCaUrls: [] },
      }),
    },
    platform: 'darwin',
    version: '2.2.6',
    initialMode: 'compatibility',
    setMode: async () => {},
    desktopSettings: scope({
      mode: 'compatibility',
      openBrowser: true,
      networkExposure: 'loopback',
      macosMaterial: 'off',
      windowsMaterial: 'off',
    }, setProperty),
    notificationSettings: scope({
      enabled: false,
      notifyOnTurnCompletion: false,
      notifyOnTurnFailure: false,
      notifyOnJobCompletion: false,
      notifyOnJobFailure: false,
      notifyOnScheduleCompletion: false,
      notifyOnScheduleFailure: false,
    }),
  } as unknown as DesktopSettingsSectionProps
  await act(async () => { root!.render(createElement(DesktopSettingsSection, props)) })
  return { host: container, setProperty }
}

/** The LAN access switch is the toggle row whose label is `lanAccess`. */
function lanToggle(host: HTMLElement): HTMLButtonElement {
  const rows = [...host.querySelectorAll<HTMLElement>('.dshDesktopSettingsToggleRow')]
  const row = rows.find(candidate => candidate.textContent?.includes(zh.lanAccess))
  const toggle = row?.querySelector<HTMLButtonElement>('button[role="switch"]')
  if (toggle === undefined || toggle === null) throw new Error('LAN toggle row is missing')
  return toggle
}

function keydown(key: string, init: KeyboardEventInit = {}): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }))
}

afterEach(async () => {
  await act(async () => { root?.unmount() })
  root = undefined
  container?.remove()
  vi.unstubAllGlobals()
})

describe('Desktop settings LAN confirmation', () => {
  it('moves focus into the dialog, keeps Tab inside it, and returns focus on Escape', async () => {
    const { host } = await mount()
    const toggle = lanToggle(host)
    toggle.focus()

    await act(async () => { toggle.click() })

    const dialog = host.querySelector<HTMLElement>('[role="alertdialog"]')
    expect(dialog).not.toBeNull()
    const cancel = dialog!.querySelector<HTMLButtonElement>('.dshDesktopSettingsButtonSecondary')!
    const confirm = dialog!.querySelector<HTMLButtonElement>('.dshDesktopSettingsButtonDanger')!
    expect(cancel.textContent).toBe(zh.lanCancel)
    // 打开后焦点必须在对话框内（此前停在对话框外的开关上）。
    expect(document.activeElement).toBe(cancel)

    // Tab 从最后一个按钮回到第一个按钮，不落到对话框之外的背景控件。
    confirm.focus()
    await act(async () => { keydown('Tab') })
    expect(document.activeElement).toBe(cancel)
    cancel.focus()
    await act(async () => { keydown('Tab', { shiftKey: true }) })
    expect(document.activeElement).toBe(confirm)

    // Escape 取消确认，并把焦点还给触发它的开关。
    await act(async () => { keydown('Escape') })
    expect(host.querySelector('[role="alertdialog"]')).toBeNull()
    expect(document.activeElement).toBe(toggle)
  })

  it('still enables LAN only from the explicit confirm button', async () => {
    const { host, setProperty } = await mount()
    const toggle = lanToggle(host)

    await act(async () => { toggle.click() })
    const dialog = host.querySelector<HTMLElement>('[role="alertdialog"]')!
    const cancel = dialog.querySelector<HTMLButtonElement>('.dshDesktopSettingsButtonSecondary')!

    await act(async () => { cancel.click() })
    expect(host.querySelector('[role="alertdialog"]')).toBeNull()
    expect(setProperty).not.toHaveBeenCalled()
    expect(toggle.getAttribute('aria-checked')).toBe('false')

    await act(async () => { toggle.click() })
    const reopened = host.querySelector<HTMLElement>('[role="alertdialog"]')!
    const confirm = reopened.querySelector<HTMLButtonElement>('.dshDesktopSettingsButtonDanger')!
    await act(async () => { confirm.click() })
    expect(host.querySelector('[role="alertdialog"]')).toBeNull()
    // 只有显式确认才把 LAN 曝光写入 Host 设置。
    expect(setProperty).toHaveBeenCalledWith('networkExposure', 'lan')
  })
})
