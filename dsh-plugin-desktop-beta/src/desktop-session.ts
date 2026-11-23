/**
 * Admit one Desktop window generation as its Host's owner.
 *
 * The launcher mints a session credential per Host generation and hands it to the window's own
 * Electron session as a cookie. `@deepseek-ai/dsh-host-authentication-desktop` verifies that
 * cookie and returns an owner peer, which is what the 0.2.3 kernel requires before it serves the
 * Web root or any authenticated route. Mounting it here keeps the upstream loopback token out of
 * the Desktop entirely: no `?token=` URL, no exchange round trip, nothing credential-bearing in
 * renderer history.
 */
import * as DesktopAuthentication from '@deepseek-ai/dsh-host-authentication-desktop'
import type { Context } from '@deepseek-ai/cordis'
import { DESKTOP_SESSION_SECRET_PATTERN } from './desktop-network.ts'

/** Session credential of one Host generation, as the launcher minted it. */
export interface DesktopSessionSecret {
  readonly secret: string
}

/**
 * Mount this generation's session provider and publish its credential to the desktop shell.
 *
 * The provider waits for `connection.authentication`, so mounting here — before the profile tree
 * loads — is what makes every later HTTP and upgrade authorization see it.
 *
 * @param ctx - Host context of the generation that is booting.
 * @param secret - credential the launcher also installs into the window's Electron session.
 */
export async function mountDesktopSessionAuthentication(
  ctx: Context,
  secret: string,
): Promise<void> {
  if (!DESKTOP_SESSION_SECRET_PATTERN.test(secret)) {
    throw new TypeError('dsh-plugin-desktop: Desktop session secret must be 43 base64url characters')
  }
  ctx.provide('desktopSessionSecret', Object.freeze({ secret }))
  await ctx.plugin(DesktopAuthentication, { readSecret: () => secret })
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Launcher-minted session credential of the running Host generation. */
    desktopSessionSecret: DesktopSessionSecret
  }
}
