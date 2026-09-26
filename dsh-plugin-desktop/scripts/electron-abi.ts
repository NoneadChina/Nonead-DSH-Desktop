/** Single source of truth for the Electron module ABI that packaged native bindings embed. */

import { createRequire } from 'node:module'
import { getAbi } from 'node-abi'

const require = createRequire(import.meta.url)

/**
 * Derive the Electron module ABI (`process.versions.modules`) from the Electron
 * release this workspace has installed.
 *
 * Native bindings are written and loaded under this number: `prepare-fs-ext.ts`
 * names the artifact from the ABI node-gyp recorded, and the fs-ext patch
 * resolves `electron.abi${process.versions.modules}.node` at runtime. Every
 * packaging inventory must therefore read the number from the same place instead
 * of pinning a literal that silently goes stale when the Electron pin moves.
 * @returns the decimal Electron ABI, for example `149`.
 */
export function pinnedElectronAbi(): string {
  const version: unknown = require('electron/package.json').version
  if (typeof version !== 'string' || version.length === 0) {
    throw new Error('dsh-plugin-desktop: the installed Electron manifest has no version')
  }
  const abi = getAbi(version, 'electron')
  if (abi === null || abi === undefined || !/^\d+$/u.test(abi)) {
    throw new Error(`dsh-plugin-desktop: cannot resolve the Electron module ABI for Electron ${version}`)
  }
  return abi
}
