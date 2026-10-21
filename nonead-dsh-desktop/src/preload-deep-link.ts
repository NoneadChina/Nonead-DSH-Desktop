/** Deliver a `dsh-desktop://` link to the mounted renderer. */
import { ipcRenderer } from 'electron'
import type { DesktopDeepLink } from './deep-link.ts'
import { IPC } from './ipc.ts'

export function onDeepLink(listener: (link: DesktopDeepLink) => void): () => void {
  const receive = (_event: unknown, link: unknown): void => {
    if (!link || typeof link !== 'object') return
    const candidate = link as Partial<DesktopDeepLink>
    if (typeof candidate.url !== 'string' || typeof candidate.action !== 'string') return
    listener({ url: candidate.url, action: candidate.action,
      segments: Array.isArray(candidate.segments) ? candidate.segments.filter((value): value is string => typeof value === 'string') : [],
      params: candidate.params && typeof candidate.params === 'object' ? candidate.params as Record<string, string> : {} })
  }
  ipcRenderer.on(IPC.deepLink, receive)
  return () => { ipcRenderer.removeListener(IPC.deepLink, receive) }
}
