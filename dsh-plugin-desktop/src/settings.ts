/** Configurable Desktop settings entry backed by the profile patch document. */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-settings'
import { DESKTOP_DEFAULT_WEB_PORT } from './desktop-port.ts'
import {
  parseDesktopNetworkExposure,
  parseDesktopOpenBrowser,
  type DesktopNetworkExposure,
} from './desktop-network.ts'
import type { DesktopShellMode } from './runtime.ts'
import {
  DEFAULT_MACOS_WINDOW_MATERIAL,
  DEFAULT_WINDOWS_WINDOW_MATERIAL,
  parseMacosWindowMaterial,
  parseWindowsWindowMaterial,
  type MacosWindowMaterial,
  type PersistedWindowsWindowMaterial,
} from './window-material.ts'

/** Stable Cordis plugin name. */
export const name = 'dsh-desktop'

/** Profile patch row id, which is also the upstream settings entry id. */
export const DESKTOP_SETTINGS_ENTRY_ID = 'dsh-desktop'

/** Desktop log levels forwarded to the file exporter. */
export type DesktopLogLevel = 'debug' | 'info' | 'warn' | 'error'

/** Effective Desktop settings owned by the `dsh-desktop` profile patch row. */
export interface DesktopSettings {
  mode: DesktopShellMode
  macosMaterial: MacosWindowMaterial
  windowsMaterial: PersistedWindowsWindowMaterial
  port: number
  openBrowser: boolean
  networkExposure: DesktopNetworkExposure
  logLevel: DesktopLogLevel
  width: number
  height: number
  minWidth: number
  minHeight: number
}

/**
 * Mark one field as editable without remounting the whole plugin tree.
 *
 * Upstream 0.1.7 packages mark volatile fields through `Schema#volatile()`, and
 * `@deepseek-ai/dsh-settings` only edits paths beneath such a node. A volatile
 * field parses into a stable reference read with `.get()`; the settings service
 * projects those references back to plain values through `plainConfig`.
 * @param schema - fully built field schema.
 * @returns the field schema wrapped as a volatile reference.
 */
export function volatileField<T extends z>(schema: T) {
  return schema.volatile()
}

/** Editable Desktop settings, including the window geometry of the shell row. */
export const Config = z.object({
  // Legacy key. It stays schema-valid so a profile written by an older build
  // still loads; every read path resolves it to the single shipped
  // presentation, and no Desktop surface offers to change it.
  mode: volatileField(z.union(['compatibility', 'extended', 'advanced'] as const).default('compatibility')),
  macosMaterial: volatileField(z.union(['off', 'transparent'] as const).default(DEFAULT_MACOS_WINDOW_MATERIAL)),
  windowsMaterial: volatileField(z.union(['off', 'acrylic', 'mica'] as const).default(DEFAULT_WINDOWS_WINDOW_MATERIAL)),
  port: volatileField(z.number().step(1).min(0).max(65_535).default(DESKTOP_DEFAULT_WEB_PORT)),
  openBrowser: volatileField(z.boolean().default(false)),
  networkExposure: volatileField(z.union(['loopback', 'lan'] as const).default('loopback')),
  logLevel: volatileField(z.union(['debug', 'info', 'warn', 'error'] as const).default('info')),
  width: volatileField(z.number().step(1).min(800).default(1280)),
  height: volatileField(z.number().step(1).min(600).default(840)),
  minWidth: volatileField(z.number().step(1).min(640).default(900)),
  minHeight: volatileField(z.number().step(1).min(480).default(640)),
})

/** Defaults applied whenever the entry is absent from the composition. */
const DEFAULT_DESKTOP_SETTINGS: DesktopSettings = Object.freeze({
  mode: 'compatibility',
  macosMaterial: DEFAULT_MACOS_WINDOW_MATERIAL,
  windowsMaterial: DEFAULT_WINDOWS_WINDOW_MATERIAL,
  port: DESKTOP_DEFAULT_WEB_PORT,
  openBrowser: false,
  networkExposure: 'loopback',
  logLevel: 'info',
  width: 1280,
  height: 840,
  minWidth: 900,
  minHeight: 640,
})

/** Narrow one projected settings value to a plain record. */
function plainRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

/** Narrow the projected log level to a supported value. */
function parseDesktopLogLevel(value: unknown): DesktopLogLevel {
  if (value === undefined) return 'info'
  if (value === 'debug' || value === 'info' || value === 'warn' || value === 'error') return value
  throw new Error('dsh-desktop.logLevel must be "debug", "info", "warn" or "error"')
}

/**
 * Narrow the projected shell mode.
 *
 * The product ships a single compatibility presentation, so a legacy persisted
 * value resolves to compatibility rather than failing the settings read.
 * @param value - projected `mode` field.
 * @returns the single supported shell mode.
 */
function parseDesktopShellMode(value: unknown): DesktopShellMode {
  if (value === undefined) return DEFAULT_DESKTOP_SETTINGS.mode
  if (value === 'compatibility' || value === 'extended' || value === 'advanced') return DEFAULT_DESKTOP_SETTINGS.mode
  throw new Error('dsh-desktop.mode must be "compatibility", "extended", or "advanced"')
}

/** Narrow the projected web server port. */
function parseDesktopPort(value: unknown): number {
  if (value === undefined) return DEFAULT_DESKTOP_SETTINGS.port
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 65_535) {
    throw new Error('dsh-desktop.port must be an integer from 0 through 65535')
  }
  return value
}

/** Narrow one projected numeric leaf, falling back to its default. */
function parseDesktopNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/**
 * Read one projected settings section by entry id.
 *
 * The projection is always plain, so callers may read foreign entries without
 * depending on this package's schemastery version.
 * @param ctx - host context carrying the optional `settings` service.
 * @param entryId - profile patch row id of the wanted entry.
 * @returns the projected section, or `undefined` while the entry is absent.
 */
export function readSettingsSection(
  ctx: Context,
  entryId: string,
): Record<string, unknown> | undefined {
  const descriptor = ctx.get('settings')?.describe().find(entry => entry.ns === entryId)
  return descriptor === undefined ? undefined : plainRecord(descriptor.value)
}

/**
 * Read the effective Desktop settings of this context.
 *
 * The value comes from the settings projection rather than the resolved plugin
 * config so it stays plain and version independent.
 * @param ctx - host context carrying the optional `settings` service.
 * @returns complete settings with the schema defaults applied.
 */
export function readDesktopSettings(ctx: Context): DesktopSettings {
  const value = readSettingsSection(ctx, DESKTOP_SETTINGS_ENTRY_ID)
  if (value === undefined) return DEFAULT_DESKTOP_SETTINGS
  return {
    mode: parseDesktopShellMode(value.mode),
    macosMaterial: parseMacosWindowMaterial(value.macosMaterial),
    windowsMaterial: parseWindowsWindowMaterial(value.windowsMaterial),
    port: parseDesktopPort(value.port),
    openBrowser: parseDesktopOpenBrowser(value.openBrowser),
    networkExposure: parseDesktopNetworkExposure(value.networkExposure),
    logLevel: parseDesktopLogLevel(value.logLevel),
    width: parseDesktopNumber(value.width, DEFAULT_DESKTOP_SETTINGS.width),
    height: parseDesktopNumber(value.height, DEFAULT_DESKTOP_SETTINGS.height),
    minWidth: parseDesktopNumber(value.minWidth, DEFAULT_DESKTOP_SETTINGS.minWidth),
    minHeight: parseDesktopNumber(value.minHeight, DEFAULT_DESKTOP_SETTINGS.minHeight),
  }
}

/**
 * Publish the editable Desktop settings entry.
 *
 * The entry owns no behavior of its own: every other Desktop surface reads the
 * effective values through {@link readDesktopSettings}, so a settings write only
 * has to make the Loader re-apply this row. The Desktop ships its own settings
 * page, so the schema-generated presentation is declined the way the upstream
 * Settings README prescribes: an optional child names the owning fiber, so a
 * late Settings service still picks the policy up. No default export: a Cordis
 * function plugin is identified by its named exports.
 * @param ctx - host context owning the row.
 */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (child) => {
    child.effect(
      () => child.settings.configure({ auto: false }, ctx.fiber),
      'dsh-plugin-desktop: settings presentation',
    )
  })
}
