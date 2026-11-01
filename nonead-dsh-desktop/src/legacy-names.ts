/**
 * One-time compatibility reads for the pre-rename data layout.
 *
 * The application was renamed from `DSH NEXT`/`dsh-desktop-next` to
 * `Nonead DSH Desktop`/`nonead-dsh-desktop`. Files and directories that earlier
 * releases wrote keep their old names on disk, so every reader checks the new
 * name first and falls back to the legacy name exactly once. Nothing is
 * rewritten implicitly: a legacy file keeps working until the owning writer
 * saves it under the new name.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { readPrivateFile } from './private-files.ts'

/** Legacy on-disk names, relative to the same directory as their replacements. */
export const LEGACY = Object.freeze({
  location: 'desktop-next-location.json',
  selection: 'desktop-next.json',
  features: 'desktop-next.features.json',
  overlay: 'desktop-next.cordis.patch.json',
  logFile: 'desktop-next.log',
})

/** Read `name`, falling back to `legacy` in the same directory. */
export function readPrivateFileWithLegacy(directory: string, name: string, legacy: string): string | undefined {
  return readPrivateFile(join(directory, name)) ?? readPrivateFile(join(directory, legacy))
}

/** New path when it exists, otherwise the legacy path (whether or not it exists). */
export function existingPath(directory: string, name: string, legacy: string): string {
  const current = join(directory, name)
  return existsSync(current) ? current : join(directory, legacy)
}
