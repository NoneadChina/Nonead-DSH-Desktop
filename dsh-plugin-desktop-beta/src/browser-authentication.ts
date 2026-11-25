/** Tokenized browser URLs minted for the Host this process owns. */

import type { Context } from '@deepseek-ai/cordis'
import { launchTokenFor } from '@deepseek-ai/dsh-host-authentication-token'

/**
 * Add the launch token the Host's browser authorization accepts to a clean URL.
 *
 * The token is process-scoped: the Host mints it once for its root application
 * context, and the Desktop shell shares that context, so the same token reaches
 * both the Host's own authorization hook and every URL the shell publishes.
 * @param ctx - any context in the Host's application tree.
 * @param baseUrl - clean browser URL whose authority and mount are preserved.
 * @returns the same URL carrying the process token as its sole authentication input.
 */
export function authenticatedBrowserUrl(ctx: Context, baseUrl: string): string {
  const url = new URL(baseUrl)
  url.searchParams.set('token', launchTokenFor(ctx))
  return url.href
}
