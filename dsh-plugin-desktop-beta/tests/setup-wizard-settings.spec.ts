import {
  lstatSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseDocument } from 'yaml'
import { afterEach, describe, expect, it } from 'vitest'
import {
  defaultDesktopSetupWizardSettings,
  importDesktopLegacySettingsDocument,
  migrateDesktopBrowserAccessSettings,
  migrateDesktopWindowMaterialSettings,
  readDesktopSetupWizardSettings,
  sameDesktopSetupWizardSettings,
  updateDesktopSetupWizardSettings,
  type DesktopSetupWizardSettings,
} from '../src/setup-wizard-settings.ts'

/**
 * Patch-entry names this edition declares for the two rows it owns. They appear
 * in fixtures only: the store looks rows up by `id`, and a pre-existing row
 * keeps its own `name` because no writer assigns one over it.
 */
const DESKTOP_ROW_NAME = 'dsh-plugin-desktop-beta/settings'
const NOTIFICATIONS_ROW_NAME = 'dsh-plugin-desktop-beta/notifications'

const temporaryDirectories: string[] = []

function temporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-setup-settings-'))
  temporaryDirectories.push(directory)
  return directory
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

function values(overrides: Partial<DesktopSetupWizardSettings> = {}): DesktopSetupWizardSettings {
  return {
    mode: 'compatibility',
    macosMaterial: 'transparent',
    windowsMaterial: 'mica',
    openBrowser: true,
    networkExposure: 'lan',
    notifications: {
      enabled: true,
      notifyOnTurnCompletion: false,
      notifyOnTurnFailure: true,
      notifyOnJobCompletion: false,
      notifyOnJobFailure: true,
    },
    ...overrides,
  }
}

/** One entry of the profile patch document as it was persisted. */
interface RawPatchRow {
  id?: unknown
  name?: unknown
  config?: Record<string, unknown>
}

function patchRows(path: string): RawPatchRow[] {
  return parseDocument(readFileSync(path, 'utf8')).toJS() as RawPatchRow[]
}

function jsonRows(path: string): RawPatchRow[] {
  return JSON.parse(readFileSync(path, 'utf8')) as RawPatchRow[]
}

function findRow(rows: readonly RawPatchRow[], id: string): RawPatchRow {
  const row = rows.find(candidate => candidate.id === id)
  if (row === undefined) throw new Error(`patch document has no entry with id ${id}`)
  return row
}

describe('Desktop Setup Wizard settings document', () => {
  it('compares the normalized leaves used by the startup re-prepare gate', () => {
    const current = values()

    expect(sameDesktopSetupWizardSettings(current, structuredClone(current))).toBe(true)
    expect(sameDesktopSetupWizardSettings(current, values({ mode: 'extended' }))).toBe(false)
    expect(sameDesktopSetupWizardSettings(current, values({
      notifications: {
        ...current.notifications,
        notifyOnTurnCompletion: true,
      },
    }))).toBe(false)
  })

  it('returns platform defaults for an absent exact settings document', () => {
    const root = temporaryDirectory()
    expect(readDesktopSetupWizardSettings(join(root, 'settings.yaml')))
      .toEqual(defaultDesktopSetupWizardSettings())
    expect(readDesktopSetupWizardSettings(join(root, 'settings.json')))
      .toEqual(defaultDesktopSetupWizardSettings())
    expect(defaultDesktopSetupWizardSettings()).toMatchObject({
      mode: 'compatibility',
      macosMaterial: 'transparent',
      windowsMaterial: 'off',
      openBrowser: false,
      networkExposure: 'loopback',
    })
  })

  it('updates YAML leaves while preserving comments, unknown fields, and inactive-platform material', async () => {
    const root = temporaryDirectory()
    const path = join(root, 'settings.yaml')
    writeFileSync(path, [
      '# settings owner comment',
      '- id: other-plugin',
      '  name: other-plugin',
      '  config:',
      '    token: keep-me',
      '- id: dsh-desktop',
      `  name: ${DESKTOP_ROW_NAME}`,
      '  config:',
      '    # presentation comment',
      '    mode: compatibility',
      '    macosMaterial: transparent',
      '    windowsMaterial: acrylic',
      '    port: 61201',
      '    logLevel: warn',
      '    futureField: preserved',
      '- id: dsh-desktop-notifications',
      `  name: ${NOTIFICATIONS_ROW_NAME}`,
      '  config:',
      '    enabled: false',
      '    notifyOnTurnCompletion: true',
      '    futureNotification: keep',
      '',
    ].join('\n'), { mode: 0o600 })

    const next = values()
    await expect(updateDesktopSetupWizardSettings(path, next)).resolves.toEqual(next)

    const text = readFileSync(path, 'utf8')
    expect(text).toContain('# settings owner comment')
    expect(text).toContain('# presentation comment')
    const rows = patchRows(path)
    expect(rows.map(row => row.id)).toEqual(['other-plugin', 'dsh-desktop', 'dsh-desktop-notifications'])
    expect(findRow(rows, 'other-plugin')).toEqual({
      id: 'other-plugin',
      name: 'other-plugin',
      config: { token: 'keep-me' },
    })
    expect(findRow(rows, 'dsh-desktop').config).toMatchObject({
      mode: 'compatibility',
      macosMaterial: 'transparent',
      windowsMaterial: 'mica',
      port: 61201,
      logLevel: 'warn',
      futureField: 'preserved',
      openBrowser: true,
      networkExposure: 'lan',
    })
    expect(findRow(rows, 'dsh-desktop-notifications').config).toEqual({
      enabled: true,
      notifyOnTurnCompletion: false,
      notifyOnTurnFailure: true,
      notifyOnJobCompletion: false,
      notifyOnJobFailure: true,
      futureNotification: 'keep',
    })
    expect(readDesktopSetupWizardSettings(path)).toEqual(next)
    expect(readdirSync(root)).toEqual(['settings.yaml'])
    if (process.platform !== 'win32') expect(statSync(path).mode & 0o777).toBe(0o600)
  })

  it('creates and updates JSON without dropping unrelated namespaces or unknown leaves', async () => {
    const root = temporaryDirectory()
    const path = join(root, 'custom-settings.json')
    writeFileSync(path, `${JSON.stringify([
      { id: 'custom', name: 'custom', config: { retained: ['a', 'b'] } },
      {
        id: 'dsh-desktop',
        name: DESKTOP_ROW_NAME,
        config: {
          mode: 'extended',
          macosMaterial: 'off',
          windowsMaterial: 'acrylic',
          future: 42,
        },
      },
      { id: 'dsh-desktop-notifications', name: NOTIFICATIONS_ROW_NAME, config: { future: 'yes' } },
    ], undefined, 2)}\n`, { mode: 0o600 })
    const next = values({
      mode: 'compatibility',
      macosMaterial: 'transparent',
      windowsMaterial: 'off',
    })

    await updateDesktopSetupWizardSettings(path, next)

    const rows = jsonRows(path)
    expect(rows.map(row => row.id))
      .toEqual(['custom', 'dsh-desktop', 'dsh-desktop-notifications'])
    expect(findRow(rows, 'custom')).toEqual({
      id: 'custom',
      name: 'custom',
      config: { retained: ['a', 'b'] },
    })
    expect(findRow(rows, 'dsh-desktop').config).toMatchObject({
      mode: 'compatibility',
      macosMaterial: 'transparent',
      windowsMaterial: 'off',
      future: 42,
      openBrowser: true,
      networkExposure: 'lan',
    })
    expect(findRow(rows, 'dsh-desktop-notifications').config).toMatchObject({ future: 'yes' })
    expect(readDesktopSetupWizardSettings(path)).toEqual(next)
  })

  it('creates an absent YAML document with every supported field', async () => {
    const root = temporaryDirectory()
    const path = join(root, 'nested', 'settings.yml')
    const next = values({
      mode: 'extended',
      macosMaterial: 'transparent',
      openBrowser: false,
      networkExposure: 'loopback',
    })

    await updateDesktopSetupWizardSettings(path, next)

    expect(lstatSync(path).isFile()).toBe(true)
    expect(readDesktopSetupWizardSettings(path)).toEqual(next)
    expect(patchRows(path).map(row => row.id))
      .toEqual(['dsh-desktop', 'dsh-desktop-notifications'])
  })

  it('does not overwrite malformed syntax, invalid roots, or invalid known values', async () => {
    const root = temporaryDirectory()
    const path = join(root, 'settings.yaml')
    for (const text of [
      'dsh-desktop: [unterminated\n',
      'dsh-desktop:\n  mode: compatibility\n',
      '- not\n- a profile patch entry map\n',
      '- id: dsh-desktop\n  config:\n    mode: impossible\n',
      '- id: dsh-desktop-notifications\n  config:\n    enabled: sometimes\n',
    ]) {
      writeFileSync(path, text, { mode: 0o600 })
      await expect(updateDesktopSetupWizardSettings(path, values())).rejects.toThrow()
      expect(readFileSync(path, 'utf8')).toBe(text)
      expect(readdirSync(root)).toEqual(['settings.yaml'])
    }
  })

  it('does not overwrite empty, malformed, or non-UTF-8 JSON', async () => {
    const root = temporaryDirectory()
    const path = join(root, 'settings.json')
    const invalidDocuments = [
      Buffer.from(''),
      Buffer.from('{not-json}\n'),
      Buffer.from([0xff]),
      Buffer.from('{"dsh-desktop": {"mode": "compatibility"}}\n'),
      Buffer.from('["not a profile patch entry"]\n'),
    ]
    for (const contents of invalidDocuments) {
      writeFileSync(path, contents, { mode: 0o600 })
      await expect(updateDesktopSetupWizardSettings(path, values())).rejects.toThrow()
      expect(readFileSync(path)).toEqual(contents)
    }
  })

  it('requires a complete update and clamps LAN exposure without browser access', async () => {
    const path = join(temporaryDirectory(), 'settings.json')
    const incomplete = values({
      openBrowser: false,
      networkExposure: 'lan',
      notifications: { enabled: true } as DesktopSetupWizardSettings['notifications'],
    })
    await expect(updateDesktopSetupWizardSettings(path, incomplete))
      .rejects.toThrow('all five notification booleans')

    const next = values({ openBrowser: false, networkExposure: 'lan' })
    await expect(updateDesktopSetupWizardSettings(path, next)).resolves.toMatchObject({
      openBrowser: false,
      networkExposure: 'loopback',
    })
    expect(readDesktopSetupWizardSettings(path)).toMatchObject({
      openBrowser: false,
      networkExposure: 'loopback',
    })

    // A legacy mode no longer withdraws the requested browser access.
    const legacyMode = values({ mode: 'advanced', openBrowser: true, networkExposure: 'lan' })
    await expect(updateDesktopSetupWizardSettings(path, legacyMode)).resolves.toMatchObject({
      mode: 'advanced',
      openBrowser: true,
      networkExposure: 'lan',
    })
    expect(readDesktopSetupWizardSettings(path)).toMatchObject({
      mode: 'advanced',
      openBrowser: true,
      networkExposure: 'lan',
    })
  })

  it('projects legacy LAN exposure as explicit compatibility browser access', () => {
    const path = join(temporaryDirectory(), 'settings.yaml')
    writeFileSync(path, [
      '- id: dsh-desktop',
      `  name: ${DESKTOP_ROW_NAME}`,
      '  config:',
      '    openBrowser: false',
      '    networkExposure: lan',
      '',
    ].join('\n'))

    expect(readDesktopSetupWizardSettings(path)).toMatchObject({
      mode: 'compatibility',
      openBrowser: true,
      networkExposure: 'lan',
    })
  })

  it('atomically materializes legacy browser access for every persisted mode', async () => {
    const root = temporaryDirectory()
    const yamlPath = join(root, 'legacy.yaml')
    writeFileSync(yamlPath, [
      '# preserve browser migration comments',
      '- id: dsh-desktop',
      `  name: ${DESKTOP_ROW_NAME}`,
      '  config:',
      '    mode: advanced',
      '    openBrowser: false',
      '    networkExposure: lan',
      '    future: keep',
      '',
    ].join('\n'))

    await expect(migrateDesktopBrowserAccessSettings(yamlPath)).resolves.toBe(true)
    await expect(migrateDesktopBrowserAccessSettings(yamlPath)).resolves.toBe(false)
    const migrated = readFileSync(yamlPath, 'utf8')
    expect(migrated).toContain('# preserve browser migration comments')
    expect(findRow(patchRows(yamlPath), 'dsh-desktop').config).toMatchObject({
      mode: 'advanced',
      openBrowser: true,
      networkExposure: 'lan',
      future: 'keep',
    })

    const jsonPath = join(root, 'legacy.json')
    writeFileSync(jsonPath, `${JSON.stringify([
      {
        id: 'dsh-desktop',
        name: DESKTOP_ROW_NAME,
        config: {
          mode: 'extended',
          openBrowser: true,
          networkExposure: 'loopback',
        },
      },
      { id: 'untouched', name: 'other-plugin', config: { value: 1 } },
    ], undefined, 2)}\n`)
    // An explicit grant is already consistent, so no migration is needed.
    await expect(migrateDesktopBrowserAccessSettings(jsonPath)).resolves.toBe(false)
    const rows = jsonRows(jsonPath)
    expect(findRow(rows, 'dsh-desktop').config).toMatchObject({
      mode: 'extended',
      openBrowser: true,
      networkExposure: 'loopback',
    })
    expect(findRow(rows, 'untouched')).toEqual({
      id: 'untouched',
      name: 'other-plugin',
      config: { value: 1 },
    })
  })

  it('preserves legacy LAN intent by materializing compatibility browser access', async () => {
    const path = join(temporaryDirectory(), 'legacy.yaml')
    writeFileSync(path, [
      '- id: dsh-desktop',
      `  name: ${DESKTOP_ROW_NAME}`,
      '  config:',
      '    mode: compatibility',
      '    openBrowser: false',
      '    networkExposure: lan',
      '',
    ].join('\n'))

    await expect(migrateDesktopBrowserAccessSettings(path)).resolves.toBe(true)
    await expect(migrateDesktopBrowserAccessSettings(path)).resolves.toBe(false)
    expect(findRow(patchRows(path), 'dsh-desktop').config).toMatchObject({
      mode: 'compatibility',
      openBrowser: true,
      networkExposure: 'lan',
    })
  })

  it('does not acquire a writer lock when browser access settings are already normalized', async () => {
    const root = temporaryDirectory()
    const path = join(root, 'settings.yaml')
    const lockPath = `${path}.lock`
    const contents = [
      '- id: dsh-desktop',
      `  name: ${DESKTOP_ROW_NAME}`,
      '  config:',
      '    mode: compatibility',
      '    macosMaterial: transparent',
      '',
    ].join('\n')
    writeFileSync(path, contents)
    writeFileSync(lockPath, 'owner\n')

    await expect(migrateDesktopBrowserAccessSettings(path)).resolves.toBe(false)
    expect(readFileSync(path, 'utf8')).toBe(contents)
    expect(readFileSync(lockPath, 'utf8')).toBe('owner\n')
  })

  it('does not acquire a writer lock for an unchanged Setup selection', async () => {
    const root = temporaryDirectory()
    const path = join(root, 'settings.yaml')
    const lockPath = `${path}.lock`
    const contents = [
      '- id: dsh-desktop',
      `  name: ${DESKTOP_ROW_NAME}`,
      '  config:',
      '    mode: compatibility',
      '    macosMaterial: transparent',
      '',
    ].join('\n')
    writeFileSync(path, contents)
    writeFileSync(lockPath, 'owner\n')

    await expect(updateDesktopSetupWizardSettings(path, defaultDesktopSetupWizardSettings()))
      .resolves.toEqual(defaultDesktopSetupWizardSettings())
    expect(readFileSync(path, 'utf8')).toBe(contents)
    expect(readFileSync(lockPath, 'utf8')).toBe('owner\n')
  })

  it('writes a changed Setup selection without waiting for a settings lock', async () => {
    const root = temporaryDirectory()
    const path = join(root, 'settings.yaml')
    const lockPath = `${path}.lock`
    writeFileSync(path, [
      '- id: dsh-desktop',
      `  name: ${DESKTOP_ROW_NAME}`,
      '  config:',
      '    mode: compatibility',
      '',
    ].join('\n'))
    writeFileSync(lockPath, 'owner\n')
    const next = values({
      mode: 'advanced',
      openBrowser: false,
      networkExposure: 'loopback',
    })

    await expect(updateDesktopSetupWizardSettings(path, next)).resolves.toEqual(next)
    expect(readDesktopSetupWizardSettings(path)).toEqual(next)
    expect(readFileSync(lockPath, 'utf8')).toBe('owner\n')
  })

  it('does not wait for a settings lock when a browser migration is needed', async () => {
    const root = temporaryDirectory()
    const path = join(root, 'settings.yaml')
    const lockPath = `${path}.lock`
    const contents = [
      '- id: dsh-desktop',
      `  name: ${DESKTOP_ROW_NAME}`,
      '  config:',
      '    mode: advanced',
      '    openBrowser: false',
      '    networkExposure: lan',
      '',
    ].join('\n')
    writeFileSync(path, contents)
    writeFileSync(lockPath, 'owner\n')

    await expect(migrateDesktopBrowserAccessSettings(path)).resolves.toBe(true)
    expect(readFileSync(path, 'utf8')).not.toBe(contents)
    expect(readFileSync(lockPath, 'utf8')).toBe('owner\n')
    expect(readDesktopSetupWizardSettings(path)).toMatchObject({
      mode: 'advanced',
      openBrowser: true,
      networkExposure: 'lan',
    })
  })

  it('never follows an existing settings-document symlink', async () => {
    const root = temporaryDirectory()
    const outside = join(temporaryDirectory(), 'outside.yaml')
    const path = join(root, 'settings.yaml')
    writeFileSync(outside, 'outside: true\n', { mode: 0o600 })
    symlinkSync(outside, path)

    expect(() => readDesktopSetupWizardSettings(path)).toThrow('regular file')
    await expect(updateDesktopSetupWizardSettings(path, values())).rejects.toThrow('regular file')
    expect(readFileSync(outside, 'utf8')).toBe('outside: true\n')
  })

  it('atomically migrates the removed Acrylic preference to off', async () => {
    const root = temporaryDirectory()
    const path = join(root, 'settings.yaml')
    writeFileSync(path, [
      '# preserve material migration comments',
      '- id: unrelated',
      '  name: other-plugin',
      '  config:',
      '    keep: true',
      '- id: dsh-desktop',
      `  name: ${DESKTOP_ROW_NAME}`,
      '  config:',
      '    mode: extended',
      '    windowsMaterial: acrylic',
      '    future: retained',
      '',
    ].join('\n'), { mode: 0o600 })

    expect(readDesktopSetupWizardSettings(path).windowsMaterial).toBe('off')
    await expect(migrateDesktopWindowMaterialSettings(path)).resolves.toBe(true)
    await expect(migrateDesktopWindowMaterialSettings(path)).resolves.toBe(false)

    const migrated = readFileSync(path, 'utf8')
    expect(migrated).toContain('# preserve material migration comments')
    const rows = patchRows(path)
    expect(findRow(rows, 'unrelated')).toEqual({
      id: 'unrelated',
      name: 'other-plugin',
      config: { keep: true },
    })
    expect(findRow(rows, 'dsh-desktop').config).toMatchObject({
      mode: 'extended',
      windowsMaterial: 'off',
      future: 'retained',
    })
  })

  it('serializes concurrent complete updates without producing a torn document', async () => {
    const root = temporaryDirectory()
    const path = join(root, 'settings.yaml')
    writeFileSync(path, [
      '- id: unrelated',
      '  name: other-plugin',
      '  config:',
      '    keep: true',
      '',
    ].join('\n'), { mode: 0o600 })
    const first = values({ mode: 'extended', windowsMaterial: 'off', openBrowser: false, networkExposure: 'loopback' })
    const second = values({ mode: 'compatibility', windowsMaterial: 'mica', networkExposure: 'loopback' })

    await Promise.all([
      updateDesktopSetupWizardSettings(path, first),
      updateDesktopSetupWizardSettings(path, second),
    ])

    const result = readDesktopSetupWizardSettings(path)
    expect([first, second]).toContainEqual(result)
    expect(findRow(patchRows(path), 'unrelated')).toEqual({
      id: 'unrelated',
      name: 'other-plugin',
      config: { keep: true },
    })
    expect(readdirSync(root)).toEqual(['settings.yaml'])
  })

  it('imports both retired namespace sections into the desktop patch rows', async () => {
    const root = temporaryDirectory()
    const legacyPath = join(root, 'legacy-settings.yaml')
    const documentPath = join(root, 'profile.yaml')
    writeFileSync(legacyPath, [
      '# legacy settings owner comment',
      'other-plugin:',
      '  token: keep-me',
      'dsh-desktop:',
      '  mode: extended',
      '  windowsMaterial: mica',
      'dsh-desktop-notifications:',
      '  enabled: false',
      '',
    ].join('\n'), { mode: 0o600 })
    writeFileSync(documentPath, [
      '- id: other-plugin',
      '  name: other-plugin',
      '  config:',
      '    token: keep-me',
      '',
    ].join('\n'), { mode: 0o600 })

    await expect(importDesktopLegacySettingsDocument(legacyPath, documentPath)).resolves.toBe(true)
    // The retired sections are already gone, so a second import changes nothing.
    await expect(importDesktopLegacySettingsDocument(legacyPath, documentPath)).resolves.toBe(false)

    const rows = patchRows(documentPath)
    expect(rows.map(row => row.id)).toEqual(['other-plugin', 'dsh-desktop', 'dsh-desktop-notifications'])
    expect(findRow(rows, 'other-plugin')).toEqual({
      id: 'other-plugin',
      name: 'other-plugin',
      config: { token: 'keep-me' },
    })
    expect(findRow(rows, 'dsh-desktop').config).toEqual({ mode: 'extended', windowsMaterial: 'mica' })
    expect(findRow(rows, 'dsh-desktop-notifications').config).toEqual({ enabled: false })
    expect(readDesktopSetupWizardSettings(documentPath)).toMatchObject({
      mode: 'extended',
      windowsMaterial: 'mica',
      notifications: { enabled: false },
    })

    const legacyText = readFileSync(legacyPath, 'utf8')
    expect(legacyText).toContain('# legacy settings owner comment')
    expect(parseDocument(legacyText).toJS()).toEqual({ 'other-plugin': { token: 'keep-me' } })
  })

  it('keeps existing patch row values when the legacy document disagrees', async () => {
    const root = temporaryDirectory()
    const legacyPath = join(root, 'legacy-settings.json')
    const documentPath = join(root, 'profile.json')
    writeFileSync(legacyPath, `${JSON.stringify({
      'dsh-desktop': { mode: 'extended', windowsMaterial: 'mica' },
      'dsh-desktop-notifications': { enabled: true, notifyOnTurnCompletion: false },
    }, undefined, 2)}\n`, { mode: 0o600 })
    writeFileSync(documentPath, `${JSON.stringify([
      { id: 'dsh-desktop', name: DESKTOP_ROW_NAME, config: { mode: 'advanced' } },
      {
        id: 'dsh-desktop-notifications',
        name: NOTIFICATIONS_ROW_NAME,
        config: { enabled: false, notifyOnJobFailure: false },
      },
    ], undefined, 2)}\n`, { mode: 0o600 })

    await expect(importDesktopLegacySettingsDocument(legacyPath, documentPath)).resolves.toBe(true)

    const rows = jsonRows(documentPath)
    const desktop = findRow(rows, 'dsh-desktop')
    expect(desktop.name).toBe(DESKTOP_ROW_NAME)
    expect(desktop.config).toEqual({ mode: 'advanced', windowsMaterial: 'mica' })
    expect(findRow(rows, 'dsh-desktop-notifications').config).toEqual({
      enabled: false,
      notifyOnJobFailure: false,
      notifyOnTurnCompletion: false,
    })
    expect(readDesktopSetupWizardSettings(documentPath)).toMatchObject({
      mode: 'advanced',
      windowsMaterial: 'mica',
      notifications: { enabled: false, notifyOnTurnCompletion: false },
    })
    expect(JSON.parse(readFileSync(legacyPath, 'utf8'))).toEqual({})
  })

  it('ignores an absent legacy document and refuses invalid legacy input', async () => {
    const root = temporaryDirectory()
    const documentPath = join(root, 'profile.yaml')

    await expect(importDesktopLegacySettingsDocument(join(root, 'missing.yaml'), documentPath))
      .resolves.toBe(false)
    expect(readdirSync(root)).toEqual([])

    const malformedPath = join(root, 'malformed.yaml')
    writeFileSync(malformedPath, 'dsh-desktop: [unterminated\n', { mode: 0o600 })
    await expect(importDesktopLegacySettingsDocument(malformedPath, documentPath))
      .rejects.toThrow('YAML could not be parsed')
    expect(readFileSync(malformedPath, 'utf8')).toBe('dsh-desktop: [unterminated\n')

    const invalidPath = join(root, 'invalid.yaml')
    writeFileSync(invalidPath, 'dsh-desktop:\n  mode: impossible\n', { mode: 0o600 })
    await expect(importDesktopLegacySettingsDocument(invalidPath, documentPath))
      .rejects.toThrow('must be compatibility')
    expect(readFileSync(invalidPath, 'utf8')).toBe('dsh-desktop:\n  mode: impossible\n')

    const foreignPath = join(root, 'foreign.yaml')
    writeFileSync(foreignPath, 'other-plugin:\n  token: keep-me\n', { mode: 0o600 })
    await expect(importDesktopLegacySettingsDocument(foreignPath, documentPath)).resolves.toBe(false)
    expect(readFileSync(foreignPath, 'utf8')).toBe('other-plugin:\n  token: keep-me\n')
    // Nothing valid was imported, so the live profile patch document was never created.
    expect(readdirSync(root).sort()).toEqual(['foreign.yaml', 'invalid.yaml', 'malformed.yaml'])
  })
})
