/** Connection trust fence and browser-entry recovery shared by Desktop Host surfaces. */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type { PeerAdmission } from '@deepseek-ai/dsh-client-connection'
import type { WebEntryUrl } from '@deepseek-ai/dsh-host-webserver'

/** Match one advertised entry to the base URL it was contributed for. */
function entryMatchesBaseUrl(entry: WebEntryUrl, baseUrl: string): boolean {
  let candidate: URL
  let root: URL
  try {
    candidate = new URL(entry.url)
    root = new URL(baseUrl)
  } catch {
    return false
  }
  return candidate.origin === root.origin
    && candidate.pathname === root.pathname
    && candidate.searchParams.getAll('token').length === 1
    && Boolean(candidate.searchParams.get('token'))
}

/**
 * Recover the credentialed browser entry for one advertised base URL.
 *
 * Upstream providers contribute their entry through `webserver/entry-url`; the
 * matching entry carries exactly the browser credential this route needs.
 * @param ctx - Host context carrying the Web carrier and its entry providers.
 * @param baseUrl - advertised loopback or LAN base URL without credentials.
 * @returns the authenticated entry URL, or `baseUrl` when no provider applies.
 */
export function desktopAuthenticatedUrl(ctx: Context, baseUrl: string): string {
  const entries: WebEntryUrl[] = []
  ctx.events.emit(ctx.webServer, 'webserver/entry-url', baseUrl, entries)
  return entries.find(entry => entryMatchesBaseUrl(entry, baseUrl))?.url ?? baseUrl
}

/**
 * Apply the official Connection trust and browser-auth fence before a private Desktop route.
 * @param ctx - Host context carrying the Connection handle.
 * @param req - incoming request to admit.
 * @param res - response owning a refusal status.
 * @returns whether the request was refused.
 */
export function rejectDesktopRequest(
  ctx: Context,
  req: IncomingMessage,
  res: ServerResponse,
): boolean {
  const admission: PeerAdmission = ctx.connection.admit(req)
  if ('peer' in admission) return false
  const body = admission.rejection === 401
    ? 'unauthorized'
    : admission.rejection === 503 ? 'service unavailable' : 'forbidden'
  res.writeHead(admission.rejection)
  res.end(body)
  return true
}
