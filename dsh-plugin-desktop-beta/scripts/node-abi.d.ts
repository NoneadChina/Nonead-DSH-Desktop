/**
 * Minimal ambient types for `node-abi`, which ships no declaration file.
 * Only the surface this repository consumes is declared.
 */
declare module 'node-abi' {
  /**
   * Resolve the module ABI for one runtime release.
   * @param target - runtime version, for example `44.0.0`.
   * @param runtime - runtime family; Electron releases are requested as `electron`.
   * @returns the decimal ABI as a string, or `null` when the release is unknown.
   */
  export function getAbi(target: string, runtime?: string): string | null
}
