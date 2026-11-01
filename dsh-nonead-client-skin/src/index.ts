/**
 * Host (Node) half of the skin plugin.
 *
 * Skins are browser-side: the entire effect lives in `src/client/index.ts`,
 * which is served to the page by the client module system. This host half
 * exists so the package can be mounted as a Loader row (dual-face packages
 * keep a node half at `main`; dropping it leaves the package without
 * `lib/index.js` and the host Loader cannot import it).
 */
import type { Context } from '@deepseek-ai/cordis'

export const name = 'dsh-nonead-client-skin'

export function apply(_ctx: Context): void {
  // Nothing to do server-side.
}
