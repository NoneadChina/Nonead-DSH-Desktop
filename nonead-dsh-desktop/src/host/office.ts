/** Next Office skills and bundled authoring dependencies; ported from upstream Desktop's Host composition. */
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import * as officeSkills from '@deepseek-ai/dsh-skill-office'
import * as workspaceDependencies from '@deepseek-ai/dsh-tool-workspace-dependencies'
import { insideArchive } from '../asar-archive-policy.ts'

/** Loader identity for the application-owned Office composition. */
export const name = 'desktop-office'

/** Application-selected bundled payload and installation directories. */
export interface Config {
  /** Bundled payload directory; the sibling `office-skills` directory holds the skill resources. Missing resources fail Host startup. */
  readonly source: string
  /** Directory under the Next home receiving the installed payload. */
  readonly root: string
  /**
   * Whether this composition registers the Office skill provider itself. A packaged Host loads the
   * official Web composition, which already mounts `@deepseek-ai/dsh-skill-office`; registering the
   * same `dsh-office` provider twice aborts Host startup.
   */
  readonly mountSkills?: boolean
}

/**
 * Installation name under `<home>/dsh-runtimes`. Next shares `~/.dsh` with the official Desktop, and the
 * tool replaces an installation whose manifest differs, so each edition keeps its own directory.
 */
export const PRIMARY_RUNTIME_INSTALL_NAME = 'nonead-dsh-desktop-primary-runtime'

/**
 * Resolve the Office composition for one Host start.
 * @param runtimeDir - Application directory; the archive itself when packaged.
 * @param source - Bundled payload directory the shell selected for this CPU.
 * @param home - Next home receiving the installation.
 * @returns The configuration, or undefined for a development tree whose payload was not prepared.
 * @throws For a packaged Host started without a payload path.
 */
export function resolveOfficeConfig(runtimeDir: string, source: string | undefined, home: string): Config | undefined {
  const packaged = insideArchive(runtimeDir)
  if (source === undefined) {
    if (packaged) throw new Error('Next Host requires the bundled primary runtime path')
    return undefined
  }
  if (!packaged && !existsSync(join(source, 'runtime.json'))) return undefined
  return { source, root: join(home, 'dsh-runtimes', PRIMARY_RUNTIME_INSTALL_NAME), mountSkills: !packaged }
}

/**
 * Whether the bundled payload Office skills read is on disk. Linux ships no interpreter payload, so its
 * packaged Host passes the conventional path with nothing behind it.
 * @param source - Bundled payload directory the shell selected.
 * @returns True when that directory carries the payload manifest.
 */
export function officePayloadPresent(source: string | undefined): boolean {
  return source !== undefined && existsSync(join(source, 'runtime.json'))
}

/**
 * Enable offline Office authoring and structural checks in the Next profile.
 * @param ctx - Profile scope; child plugins declare their own service requirements.
 * @param config - Bundled payload source and installation root.
 */
export async function apply(ctx: Context, config: Config): Promise<void> {
  await ctx.plugin(workspaceDependencies, config)
  if (config.mountSkills === false) return
  // Office skills read `office-skills` beside the payload, so only a platform that ships the payload
  // mounts them; Linux ships no interpreter payload and reports `office.unavailable`.
  if (!officePayloadPresent(config.source)) return
  await ctx.plugin(officeSkills, {
    assetRoot: join(dirname(config.source), 'office-skills'),
  })
}
