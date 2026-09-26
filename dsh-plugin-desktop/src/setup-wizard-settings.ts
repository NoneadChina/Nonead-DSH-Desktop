/** Pre-Host reader and atomic writer for Desktop Setup Wizard preferences. */

import {
  desktopBrowserAccessAvailable,
  desktopBrowserAccessEnabled,
  desktopNetworkExposureForBrowserAccess,
} from './desktop-network.ts'
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readSync,
} from 'node:fs'
import { dirname, extname, isAbsolute, resolve } from 'node:path'
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import { parseDocument, isMap, isSeq, type YAMLSeq } from 'yaml'
import {
  DEFAULT_MACOS_WINDOW_MATERIAL,
  DEFAULT_WINDOWS_WINDOW_MATERIAL,
  parseMacosWindowMaterial,
  parseWindowsWindowMaterial,
} from './window-material.ts'
import type {
  DesktopSetupWizardMacosMaterial,
  DesktopSetupWizardMode,
  DesktopSetupWizardNetworkExposure,
  DesktopSetupWizardNotifications,
  DesktopSetupWizardWindowsMaterial,
} from './setup-wizard-contract.ts'

const BIN_NAME = 'dsh-plugin-desktop'
const DESKTOP_NAMESPACE = 'dsh-desktop'
const NOTIFICATIONS_NAMESPACE = 'dsh-desktop-notifications'
const DESKTOP_ROW_NAME = `${BIN_NAME}/settings`
const NOTIFICATIONS_ROW_NAME = `${BIN_NAME}/notifications`
const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024
const DOCUMENT_FILE_MODE = 0o600
const DOCUMENT_DIRECTORY_MODE = 0o700

type SettingsFormat = 'yaml' | 'json'

/** Complete notification choice committed by the Setup Wizard. */
export type DesktopSetupWizardNotificationSettings = DesktopSetupWizardNotifications

/** Preferences shown and saved before the Desktop Host boots. */
export interface DesktopSetupWizardSettings {
  readonly mode: DesktopSetupWizardMode
  /** Preserve both platform preferences when Setup runs on either platform. */
  readonly macosMaterial: DesktopSetupWizardMacosMaterial
  /** Preserve both platform preferences when Setup runs on either platform. */
  readonly windowsMaterial: DesktopSetupWizardWindowsMaterial
  /** Persisted compatibility key for ordinary-browser access permission. */
  readonly openBrowser: boolean
  /** Native Web listener exposure; LAN requires browser access permission. */
  readonly networkExposure: DesktopSetupWizardNetworkExposure
  readonly notifications: DesktopSetupWizardNotificationSettings
}

interface LoadedSettingsDocument {
  readonly format: SettingsFormat
  readonly root: Record<string, unknown>
  readonly yaml?: ReturnType<typeof parseDocument>
}

/** Parsed profile patch document: the list of entries the Loader composes. */
interface LoadedPatchDocument {
  readonly format: SettingsFormat
  readonly rows: readonly Record<string, unknown>[]
  readonly yaml?: ReturnType<typeof parseDocument>
}

function invalid(message: string): Error {
  return new Error(`${BIN_NAME}: invalid Setup Wizard settings document: ${message}`)
}

function settingsPath(value: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\0') || !isAbsolute(value)) {
    throw new TypeError(`${BIN_NAME}: Setup Wizard settings document must be an absolute path without NUL`)
  }
  const path = resolve(value)
  const extension = extname(path).toLowerCase()
  if (extension !== '.yaml' && extension !== '.yml' && extension !== '.json') {
    throw new TypeError(`${BIN_NAME}: Setup Wizard settings document must use .yaml, .yml, or .json`)
  }
  return path
}

function formatOf(path: string): SettingsFormat {
  return extname(path).toLowerCase() === '.json' ? 'json' : 'yaml'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function readDocumentText(path: string): string | undefined {
  let pathInfo
  try {
    pathInfo = lstatSync(path)
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw cause
  }
  if (!pathInfo.isFile() || pathInfo.isSymbolicLink()) throw invalid('document must be a regular file')
  if (pathInfo.size > MAX_DOCUMENT_BYTES) {
    throw invalid(`document exceeds ${String(MAX_DOCUMENT_BYTES)} bytes`)
  }
  const descriptor = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
  try {
    const info = fstatSync(descriptor)
    if (!info.isFile() || info.size > MAX_DOCUMENT_BYTES) {
      throw invalid(`document must be a regular file within ${String(MAX_DOCUMENT_BYTES)} bytes`)
    }
    if (info.dev !== pathInfo.dev || info.ino !== pathInfo.ino) {
      throw invalid('document changed while it was being opened')
    }
    const buffer = Buffer.alloc(MAX_DOCUMENT_BYTES + 1)
    let bytesRead = 0
    while (bytesRead < buffer.byteLength) {
      const count = readSync(descriptor, buffer, bytesRead, buffer.byteLength - bytesRead, null)
      if (count === 0) break
      bytesRead += count
    }
    if (bytesRead > MAX_DOCUMENT_BYTES) {
      throw invalid(`document exceeds ${String(MAX_DOCUMENT_BYTES)} bytes`)
    }
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, bytesRead))
    } catch {
      throw invalid('document must contain valid UTF-8')
    }
  } finally {
    closeSync(descriptor)
  }
}

function loadSettingsDocument(path: string): LoadedSettingsDocument {
  const format = formatOf(path)
  const text = readDocumentText(path)
  if (format === 'json') {
    let value: unknown = {}
    if (text !== undefined) {
      try {
        value = JSON.parse(text) as unknown
      } catch {
        throw invalid('JSON could not be parsed')
      }
    }
    if (!isRecord(value)) throw invalid('root must be a map of namespace sections')
    return { format, root: value }
  }

  const yaml = parseDocument(text ?? '', { prettyErrors: true })
  if (yaml.errors.length > 0) {
    throw invalid(`YAML could not be parsed: ${yaml.errors.map(error => error.message).join('; ')}`)
  }
  const value: unknown = yaml.toJS() ?? {}
  if (!isRecord(value)) throw invalid('root must be a map of namespace sections')
  return { format, root: value, yaml }
}

function section(root: Record<string, unknown>, namespace: string): Record<string, unknown> {
  const value = root[namespace]
  if (value === undefined) return {}
  if (!isRecord(value)) throw invalid(`${namespace} must be a map`)
  return value
}

/**
 * Load the profile patch document, whose root is a list of patch entries.
 *
 * Upstream composes the active profile from these entries, so the desktop owns
 * the two rows it edits and leaves every other entry untouched.
 */
function loadPatchDocument(path: string): LoadedPatchDocument {
  const format = formatOf(path)
  const text = readDocumentText(path)
  const project = (value: unknown): readonly Record<string, unknown>[] => {
    if (value === undefined || value === null) return []
    if (!Array.isArray(value)) throw invalid('root must be a list of profile patch entries')
    return value.map((entry) => {
      if (!isRecord(entry)) throw invalid('every profile patch entry must be a map')
      return entry
    })
  }
  if (format === 'json') {
    let value: unknown
    if (text !== undefined) {
      try {
        value = JSON.parse(text) as unknown
      } catch {
        throw invalid('JSON could not be parsed')
      }
    }
    return { format, rows: project(value) }
  }
  const yaml = parseDocument(text ?? '', { prettyErrors: true })
  if (yaml.errors.length > 0) {
    throw invalid(`YAML could not be parsed: ${yaml.errors.map(error => error.message).join('; ')}`)
  }
  return { format, rows: project(yaml.toJS()), yaml }
}

/** Read the `config` map of the last entry with the given id. */
function rowConfig(rows: readonly Record<string, unknown>[], id: string): Record<string, unknown> {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index]
    if (row === undefined || row.id !== id) continue
    const config = row.config
    if (config === undefined) return {}
    if (!isRecord(config)) throw invalid(`${id} config must be a map`)
    return config
  }
  return {}
}

function optionalBoolean(values: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = values[key]
  if (value === undefined) return fallback
  if (typeof value !== 'boolean') throw invalid(`${key} must be a boolean`)
  return value
}

function parseMode(value: unknown): DesktopSetupWizardMode {
  if (value === undefined) return 'compatibility'
  if (value === 'compatibility' || value === 'extended' || value === 'advanced') return value
  throw invalid('dsh-desktop.mode must be compatibility, extended, or advanced')
}

function parseExposure(value: unknown): DesktopSetupWizardNetworkExposure {
  if (value === undefined) return 'loopback'
  if (value === 'loopback' || value === 'lan') return value
  throw invalid('dsh-desktop.networkExposure must be loopback or lan')
}

function notificationSettings(values: Record<string, unknown>): DesktopSetupWizardNotificationSettings {
  return Object.freeze({
    enabled: optionalBoolean(values, 'enabled', true),
    notifyOnTurnCompletion: optionalBoolean(values, 'notifyOnTurnCompletion', true),
    notifyOnTurnFailure: optionalBoolean(values, 'notifyOnTurnFailure', true),
    notifyOnJobCompletion: optionalBoolean(values, 'notifyOnJobCompletion', true),
    notifyOnJobFailure: optionalBoolean(values, 'notifyOnJobFailure', true),
  })
}

function projectSections(
  desktop: Record<string, unknown>,
  notifications: Record<string, unknown>,
): DesktopSetupWizardSettings {
  const mode = parseMode(desktop.mode)
  const networkExposure = parseExposure(desktop.networkExposure)
  const openBrowser = desktopBrowserAccessEnabled(
    optionalBoolean(desktop, 'openBrowser', false),
    networkExposure,
  )
  return Object.freeze({
    mode,
    macosMaterial: parseMacosWindowMaterial(desktop.macosMaterial),
    windowsMaterial: parseWindowsWindowMaterial(desktop.windowsMaterial),
    openBrowser,
    networkExposure: desktopNetworkExposureForBrowserAccess(openBrowser, networkExposure),
    notifications: notificationSettings(notifications),
  })
}

/** Project the two owned namespace sections of a legacy settings document. */
function projectSettings(
  root: Record<string, unknown>,
): DesktopSetupWizardSettings {
  return projectSections(
    section(root, DESKTOP_NAMESPACE),
    section(root, NOTIFICATIONS_NAMESPACE),
  )
}

/** Project the two owned rows of the profile patch document. */
function projectPatchSettings(
  rows: readonly Record<string, unknown>[],
): DesktopSetupWizardSettings {
  return projectSections(
    rowConfig(rows, DESKTOP_NAMESPACE),
    rowConfig(rows, NOTIFICATIONS_NAMESPACE),
  )
}

function normalizedUpdate(
  value: DesktopSetupWizardSettings,
): DesktopSetupWizardSettings {
  if (!isRecord(value)) throw new TypeError(`${BIN_NAME}: invalid Setup Wizard settings update`)
  const requestedMode = parseMode(value.mode)
  if (value.macosMaterial !== 'off' && value.macosMaterial !== 'transparent') {
    throw new TypeError(`${BIN_NAME}: macOS Setup Wizard material must be off or transparent`)
  }
  if (value.windowsMaterial !== 'off' && value.windowsMaterial !== 'mica') {
    throw new TypeError(`${BIN_NAME}: Windows Setup Wizard material must be off or mica`)
  }
  if (typeof value.openBrowser !== 'boolean') {
    throw new TypeError(`${BIN_NAME}: Setup Wizard openBrowser must be a boolean`)
  }
  const openBrowser = desktopBrowserAccessAvailable() && value.openBrowser
  const networkExposure = desktopNetworkExposureForBrowserAccess(
    openBrowser,
    parseExposure(value.networkExposure),
  )
  if (!isRecord(value.notifications)) {
    throw new TypeError(`${BIN_NAME}: Setup Wizard notifications must be a map`)
  }
  const notificationKeys: readonly (keyof DesktopSetupWizardNotificationSettings)[] = [
    'enabled',
    'notifyOnTurnCompletion',
    'notifyOnTurnFailure',
    'notifyOnJobCompletion',
    'notifyOnJobFailure',
  ]
  if (Object.keys(value.notifications).length !== notificationKeys.length
    || notificationKeys.some(key => typeof value.notifications[key] !== 'boolean')) {
    throw new TypeError(`${BIN_NAME}: Setup Wizard update must contain all five notification booleans`)
  }
  return Object.freeze({
    mode: requestedMode,
    macosMaterial: value.macosMaterial,
    windowsMaterial: value.windowsMaterial,
    openBrowser,
    networkExposure,
    notifications: Object.freeze({
      enabled: value.notifications.enabled,
      notifyOnTurnCompletion: value.notifications.notifyOnTurnCompletion,
      notifyOnTurnFailure: value.notifications.notifyOnTurnFailure,
      notifyOnJobCompletion: value.notifications.notifyOnJobCompletion,
      notifyOnJobFailure: value.notifications.notifyOnJobFailure,
    }),
  })
}

/** Return whether two normalized Setup views have identical persisted leaves. */
export function sameDesktopSetupWizardSettings(
  current: DesktopSetupWizardSettings,
  next: DesktopSetupWizardSettings,
): boolean {
  return current.mode === next.mode
    && current.macosMaterial === next.macosMaterial
    && current.windowsMaterial === next.windowsMaterial
    && current.openBrowser === next.openBrowser
    && current.networkExposure === next.networkExposure
    && current.notifications.enabled === next.notifications.enabled
    && current.notifications.notifyOnTurnCompletion === next.notifications.notifyOnTurnCompletion
    && current.notifications.notifyOnTurnFailure === next.notifications.notifyOnTurnFailure
    && current.notifications.notifyOnJobCompletion === next.notifications.notifyOnJobCompletion
    && current.notifications.notifyOnJobFailure === next.notifications.notifyOnJobFailure
}

/** Editable leaves of the Desktop settings row. */
function desktopRowConfig(next: DesktopSetupWizardSettings): Record<string, unknown> {
  return {
    mode: next.mode,
    macosMaterial: next.macosMaterial,
    windowsMaterial: next.windowsMaterial,
    openBrowser: next.openBrowser,
    networkExposure: next.networkExposure,
  }
}

/** Write one owned row into the live YAML document, appending it when absent. */
function writeYamlRow(
  document: NonNullable<LoadedPatchDocument['yaml']>,
  contents: YAMLSeq,
  id: string,
  name: string,
  values: Record<string, unknown>,
): void {
  for (let index = contents.items.length - 1; index >= 0; index -= 1) {
    const item = contents.items[index]
    if (!isMap(item) || item.get('id') !== id) continue
    for (const [key, value] of Object.entries(values)) {
      document.setIn([index, 'config', key], value)
    }
    return
  }
  document.add(document.createNode({ id, name, config: values }))
}

/** Prepare the live YAML document for row writes, creating an empty list. */
function patchYamlSequence(
  document: NonNullable<LoadedPatchDocument['yaml']>,
): YAMLSeq {
  if (document.contents === null) document.contents = document.createNode([])
  const contents = document.contents
  if (!isSeq(contents)) throw invalid('root must be a list of profile patch entries')
  return contents
}

function applyYamlUpdate(
  document: NonNullable<LoadedPatchDocument['yaml']>,
  next: DesktopSetupWizardSettings,
): string {
  const contents = patchYamlSequence(document)
  writeYamlRow(document, contents, DESKTOP_NAMESPACE, DESKTOP_ROW_NAME, desktopRowConfig(next))
  writeYamlRow(
    document,
    contents,
    NOTIFICATIONS_NAMESPACE,
    NOTIFICATIONS_ROW_NAME,
    { ...next.notifications },
  )
  return document.toString()
}

/** Write one owned row into the plain JSON projection, appending it when absent. */
function writeJsonRow(
  rows: Record<string, unknown>[],
  id: string,
  name: string,
  values: Record<string, unknown>,
): void {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index]
    if (row === undefined || row.id !== id) continue
    const existing = isRecord(row.config) ? row.config : {}
    row.config = { ...existing, ...values }
    return
  }
  rows.push({ id, name, config: values })
}

function applyJsonUpdate(
  rows: readonly Record<string, unknown>[],
  next: DesktopSetupWizardSettings,
): string {
  const output = rows.map(row => structuredClone(row))
  writeJsonRow(output, DESKTOP_NAMESPACE, DESKTOP_ROW_NAME, desktopRowConfig(next))
  writeJsonRow(output, NOTIFICATIONS_NAMESPACE, NOTIFICATIONS_ROW_NAME, { ...next.notifications })
  return `${JSON.stringify(output, undefined, 2)}\n`
}

function ensureDocumentDirectory(path: string): void {
  const directory = dirname(path)
  mkdirSync(directory, { recursive: true, mode: DOCUMENT_DIRECTORY_MODE })
  const info = lstatSync(directory)
  if (!info.isDirectory() || info.isSymbolicLink()) {
    throw invalid('document parent must be a real directory')
  }
}

/** Read defaults or validated current values from the prepared profile patch document. */
export function readDesktopSetupWizardSettings(
  documentPath: string,
): DesktopSetupWizardSettings {
  const path = settingsPath(documentPath)
  return projectPatchSettings(loadPatchDocument(path).rows)
}

/**
 * Atomically update only the leaves owned by the desktop rows, preserving every
 * other entry of the profile patch document.
 * Setup runs before the Host and never creates or waits for a settings writer
 * lock; the same-directory rename still keeps readers from seeing torn bytes.
 */
export async function updateDesktopSetupWizardSettings(
  documentPath: string,
  value: DesktopSetupWizardSettings,
): Promise<DesktopSetupWizardSettings> {
  const path = settingsPath(documentPath)
  const next = normalizedUpdate(value)
  // Explicit default leaves do not need to be materialized. Apart from making
  // Setup idempotent, this lets an unchanged first-run choice proceed while an
  // unrelated or orphaned settings writer lock exists.
  if (sameDesktopSetupWizardSettings(projectPatchSettings(loadPatchDocument(path).rows), next)) return next
  ensureDocumentDirectory(path)
  const loaded = loadPatchDocument(path)
  // Refuse to cover an invalid known value, including the inactive platform's
  // material, before touching the user's document.
  projectPatchSettings(loaded.rows)
  const output = loaded.format === 'yaml'
    ? applyYamlUpdate(loaded.yaml!, next)
    : applyJsonUpdate(loaded.rows, next)
  await writeFileAtomic(path, output, {
    mode: DOCUMENT_FILE_MODE,
    dirMode: DOCUMENT_DIRECTORY_MODE,
  })
  return next
}

/** Row-level view the browser-access migration reads before it writes. */
function browserAccessMigration(loaded: LoadedPatchDocument): {
  browserAccess: boolean
  networkExposure: DesktopSetupWizardNetworkExposure
  needed: boolean
} {
  // Validate every known desktop value before migrating any leaf.
  projectPatchSettings(loaded.rows)
  const desktop = rowConfig(loaded.rows, DESKTOP_NAMESPACE)
  const storedOpenBrowser = optionalBoolean(desktop, 'openBrowser', false)
  const storedExposure = parseExposure(desktop.networkExposure)
  const browserAccess = desktopBrowserAccessEnabled(storedOpenBrowser, storedExposure)
  const networkExposure = desktopNetworkExposureForBrowserAccess(browserAccess, storedExposure)
  return {
    browserAccess,
    networkExposure,
    needed: storedOpenBrowser !== browserAccess || storedExposure !== networkExposure,
  }
}

/**
 * Atomically migrate settings written with the former browser-handoff
 * semantics before the Host reads them. Existing LAN exposure becomes an
 * explicit browser-access grant only for an already-selected compatibility
 * mode. Incompatible modes retain their selection and withdraw browser/LAN
 * access. Returns whether the durable document changed.
 */
export async function migrateDesktopBrowserAccessSettings(
  documentPath: string,
): Promise<boolean> {
  const path = settingsPath(documentPath)

  // Most Profiles are already normalized. Keep their startup entirely
  // read-only so an unrelated or orphaned settings writer lock cannot block
  // Desktop from opening.
  if (!browserAccessMigration(loadPatchDocument(path)).needed) return false

  ensureDocumentDirectory(path)
  const loaded = loadPatchDocument(path)
  const migration = browserAccessMigration(loaded)
  if (!migration.needed) return false

  const values = {
    openBrowser: migration.browserAccess,
    networkExposure: migration.networkExposure,
  }
  let output: string
  if (loaded.format === 'yaml') {
    const document = loaded.yaml!
    writeYamlRow(document, patchYamlSequence(document), DESKTOP_NAMESPACE, DESKTOP_ROW_NAME, values)
    output = document.toString()
  } else {
    const rows = loaded.rows.map(row => structuredClone(row))
    writeJsonRow(rows, DESKTOP_NAMESPACE, DESKTOP_ROW_NAME, values)
    output = `${JSON.stringify(rows, undefined, 2)}\n`
  }
  await writeFileAtomic(path, output, {
    mode: DOCUMENT_FILE_MODE,
    dirMode: DOCUMENT_DIRECTORY_MODE,
  })
  return true
}

/**
 * Replace the removed Acrylic preference without making an old settings
 * document a startup failure. Runtime parsing already treats Acrylic as off, so
 * a read-only document remains safe even when this durable migration cannot run.
 */
export async function migrateDesktopWindowMaterialSettings(
  documentPath: string,
): Promise<boolean> {
  const path = settingsPath(documentPath)

  const needsMigration = (loaded: LoadedPatchDocument): boolean => {
    // Validate every known desktop value before changing the legacy leaf.
    projectPatchSettings(loaded.rows)
    return rowConfig(loaded.rows, DESKTOP_NAMESPACE).windowsMaterial === 'acrylic'
  }

  if (!needsMigration(loadPatchDocument(path))) return false

  ensureDocumentDirectory(path)
  const loaded = loadPatchDocument(path)
  if (!needsMigration(loaded)) return false

  const values = { windowsMaterial: 'off' }
  let output: string
  if (loaded.format === 'yaml') {
    const document = loaded.yaml!
    writeYamlRow(document, patchYamlSequence(document), DESKTOP_NAMESPACE, DESKTOP_ROW_NAME, values)
    output = document.toString()
  } else {
    const rows = loaded.rows.map(row => structuredClone(row))
    writeJsonRow(rows, DESKTOP_NAMESPACE, DESKTOP_ROW_NAME, values)
    output = `${JSON.stringify(rows, undefined, 2)}\n`
  }
  await writeFileAtomic(path, output, {
    mode: DOCUMENT_FILE_MODE,
    dirMode: DOCUMENT_DIRECTORY_MODE,
  })
  return true
}

/**
 * Move the retired namespace sections into the desktop's own profile patch rows.
 *
 * Upstream 0.1.7 renames a legacy `<home>/settings.yaml` and imports each of its
 * sections into the entry whose id equals the section key. The desktop rows
 * carry exactly those ids, so their sections are copied into the patch document
 * and then removed from the legacy document to keep the user's values from being
 * imported twice. Existing row values win, because the patch document is the
 * newer store. Returns whether the legacy document changed.
 */
export async function importDesktopLegacySettingsDocument(
  legacyPath: string,
  documentPath: string,
): Promise<boolean> {
  const path = settingsPath(legacyPath)
  if (readDocumentText(path) === undefined) return false
  const legacy = loadSettingsDocument(path)
  const ownsDesktop = legacy.root[DESKTOP_NAMESPACE] !== undefined
  const ownsNotifications = legacy.root[NOTIFICATIONS_NAMESPACE] !== undefined
  if (!ownsDesktop && !ownsNotifications) return false
  // Refuse to copy an invalid legacy value into the live document.
  projectSettings(legacy.root)

  const desktop = settingsPath(documentPath)
  const loaded = loadPatchDocument(desktop)
  const desktopValues = ownsDesktop ? section(legacy.root, DESKTOP_NAMESPACE) : {}
  const notificationValues = ownsNotifications ? section(legacy.root, NOTIFICATIONS_NAMESPACE) : {}
  const rowsConfig: { id: string; name: string; values: Record<string, unknown> }[] = [
    { id: DESKTOP_NAMESPACE, name: DESKTOP_ROW_NAME, values: desktopValues },
    { id: NOTIFICATIONS_NAMESPACE, name: NOTIFICATIONS_ROW_NAME, values: notificationValues },
  ].filter(entry => Object.keys(entry.values).length > 0)

  if (rowsConfig.length > 0) {
    ensureDocumentDirectory(desktop)
    let output: string
    if (loaded.format === 'yaml') {
      const document = loaded.yaml!
      const contents = patchYamlSequence(document)
      for (const entry of rowsConfig) {
        const existing = rowConfig(loaded.rows, entry.id)
        const missing = Object.fromEntries(
          Object.entries(entry.values).filter(([key]) => existing[key] === undefined),
        )
        if (Object.keys(missing).length === 0) continue
        writeYamlRow(document, contents, entry.id, entry.name, missing)
      }
      output = document.toString()
    } else {
      const rows = loaded.rows.map(row => structuredClone(row))
      for (const entry of rowsConfig) {
        const existing = rowConfig(rows, entry.id)
        const missing = Object.fromEntries(
          Object.entries(entry.values).filter(([key]) => existing[key] === undefined),
        )
        if (Object.keys(missing).length === 0) continue
        writeJsonRow(rows, entry.id, entry.name, missing)
      }
      output = `${JSON.stringify(rows, undefined, 2)}\n`
    }
    await writeFileAtomic(desktop, output, {
      mode: DOCUMENT_FILE_MODE,
      dirMode: DOCUMENT_DIRECTORY_MODE,
    })
  }

  delete legacy.root[DESKTOP_NAMESPACE]
  delete legacy.root[NOTIFICATIONS_NAMESPACE]
  let legacyOutput: string
  if (legacy.format === 'yaml') {
    legacy.yaml!.delete(DESKTOP_NAMESPACE)
    legacy.yaml!.delete(NOTIFICATIONS_NAMESPACE)
    legacyOutput = legacy.yaml!.toString()
  } else {
    legacyOutput = `${JSON.stringify(legacy.root, undefined, 2)}\n`
  }
  await writeFileAtomic(path, legacyOutput, {
    mode: DOCUMENT_FILE_MODE,
    dirMode: DOCUMENT_DIRECTORY_MODE,
  })
  return true
}

/** Defaults used when the settings document or both owned sections are absent. */
export function defaultDesktopSetupWizardSettings(
): DesktopSetupWizardSettings {
  return Object.freeze({
    mode: 'compatibility',
    macosMaterial: DEFAULT_MACOS_WINDOW_MATERIAL,
    windowsMaterial: DEFAULT_WINDOWS_WINDOW_MATERIAL,
    openBrowser: false,
    networkExposure: 'loopback',
    notifications: Object.freeze({
      enabled: true,
      notifyOnTurnCompletion: true,
      notifyOnTurnFailure: true,
      notifyOnJobCompletion: true,
      notifyOnJobFailure: true,
    }),
  })
}

export const desktopSetupWizardSettingsConstants = Object.freeze({
  desktopNamespace: DESKTOP_NAMESPACE,
  notificationsNamespace: NOTIFICATIONS_NAMESPACE,
  maxDocumentBytes: MAX_DOCUMENT_BYTES,
  fileMode: DOCUMENT_FILE_MODE,
})
