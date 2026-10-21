import { expect, it, vi } from 'vitest'
const electron = vi.hoisted(() => ({ ipcRenderer: { on: vi.fn(), removeListener: vi.fn() } }))
vi.mock('electron', () => electron)
import { onDeepLink } from '../src/preload-deep-link.ts'
import { IPC } from '../src/ipc.ts'
import type { DesktopDeepLink } from '../src/deep-link.ts'

it('forwards only validated links to the renderer and unsubscribes cleanly', () => {
  const received: DesktopDeepLink[] = []
  const stop = onDeepLink(link => received.push(link))
  const [channel, receive] = electron.ipcRenderer.on.mock.calls[0]! as [string, (event: unknown, link: unknown) => void]
  expect(channel).toBe(IPC.deepLink)
  receive({}, 'dsh-desktop://settings/general')
  receive({}, { url: 42, action: 'settings' })
  receive({}, { url: 'dsh-desktop://settings/general', action: 'settings', segments: ['general', 7], params: { page: 'general' } })
  expect(received).toEqual([
    { url: 'dsh-desktop://settings/general', action: 'settings', segments: ['general'], params: { page: 'general' } },
  ])
  stop()
  expect(electron.ipcRenderer.removeListener).toHaveBeenCalledExactlyOnceWith(IPC.deepLink, receive)
})
