/**
 * Package-owned invariant companion for `dsh-nonead-client-skin`.
 * @module dsh-nonead-client-skin/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = 'dsh-nonead-client-skin'

/** Cordis companion plugin name. */
export const name = 'dsh-nonead-client-skin-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the skin is a pure browser-side CSS/DOM injection with
 * no service state, session events, or registry relationships to check against
 * an authoritative stream. Teardown removes the injected style and observer,
 * which the package's loader-composition coverage verifies through the effect
 * disposers, not a runtime data relation.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
