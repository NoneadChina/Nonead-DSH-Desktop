/** `dsh-desktop://` links are parsed without Electron so routing and registration stay testable. */
export const DEEP_LINK_PROTOCOL = 'dsh-desktop'

export interface DesktopDeepLink {
  /** Normalized link as forwarded to the renderer. */
  url: string
  /** First segment, e.g. `settings` for dsh-desktop://settings/general. */
  action: string
  /** The remaining path segments, e.g. ['general']. */
  segments: string[]
  params: Record<string, string>
}

/**
 * Parse one `dsh-desktop://` link.
 * Accepted shapes: `dsh-desktop://settings/general`, `dsh-desktop://open?path=/x`, `dsh-desktop:open`.
 * @param value - raw argument, OS event URL or `open-url` payload.
 * @returns the parsed link, or undefined for any other scheme or a malformed URL.
 */
export function parseDeepLink(value: string): DesktopDeepLink | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) return undefined
  let url: URL
  try { url = new URL(value.trim()) } catch { return undefined }
  if (url.protocol.toLowerCase() !== `${DEEP_LINK_PROTOCOL}:`) return undefined
  const segments = [url.hostname, ...url.pathname.split('/')].filter(segment => segment.length > 0)
  const [action = '', ...rest] = segments
  const params: Record<string, string> = {}
  // Repeated keys keep their first value: link parameters describe one request.
  for (const [key, item] of url.searchParams) if (!(key in params)) params[key] = item
  // A link without an action names no request; `dsh-desktop://` alone is malformed.
  if (action.length === 0) return undefined
  return { url: url.href, action: action.toLowerCase(), segments: rest, params }
}

/** First deep link in an argv list; a protocol launch passes it beside the executable. */
export function deepLinkFromArgv(argv: readonly string[]): DesktopDeepLink | undefined {
  for (const value of argv) {
    if (typeof value !== 'string' || !value.toLowerCase().startsWith(`${DEEP_LINK_PROTOCOL}:`)) continue
    const link = parseDeepLink(value)
    if (link) return link
  }
  return undefined
}

/** The part of Electron's `app` needed to own the scheme. */
export interface DesktopProtocolApplication {
  setAsDefaultProtocolClient(protocol: string, executable?: string, args?: string[]): boolean
}

/**
 * Claim the scheme. A packaged build registers itself; a source run registers this Electron
 * executable plus the application directory, which is what a protocol launch then replays.
 * @returns whether the OS accepted the registration; failures stay non-fatal.
 */
export function registerDeepLinkProtocol(application: DesktopProtocolApplication,
  executable?: string, args?: string[]): boolean {
  try {
    return executable === undefined
      ? application.setAsDefaultProtocolClient(DEEP_LINK_PROTOCOL)
      : application.setAsDefaultProtocolClient(DEEP_LINK_PROTOCOL, executable, args)
  } catch { return false }
}
