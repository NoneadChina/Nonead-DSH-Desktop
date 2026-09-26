/** Headless smoke for the complete published DSH Web profile and renderer manifest. */

import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { boot, PROFILE_PATCH_FILENAME } from '@deepseek-ai/dsh-app-boot'
import { provideCmdline } from '@deepseek-ai/dsh-cmdline'
import {
  createLaunchEnvironmentSnapshot,
  DSH_LAUNCH_ENVIRONMENT_KEY,
} from '@deepseek-ai/dsh-launch-environment'
import { installDesktopPnpmRuntime } from '../lib/desktop-runtime-environment.js'
import { installProfilePackageResolver } from '../lib/module-resolution.js'
import {
  DESKTOP_PACKAGE_NAME,
  DESKTOP_PROFILE_NAME,
  desktopInstallAnchor,
  prepareDesktopProfile,
} from '../lib/profile.js'
import { DesktopProfileService } from '../lib/profile-service.js'
import { readDesktopSettings } from '../lib/settings.js'

const BIN_NAME = 'dsh-plugin-desktop-profile-smoke'
const HOST_SERVICE_PLUGIN_NAME = 'dsh-desktop-host-services-smoke-plugin'
const HOST_SERVICE_PROBE_KEY = 'desktopHostServiceProbe'
let ordinaryBrowserEnabled = false
const BROWSER_ACCESS = Object.freeze({
  get ordinaryBrowserEnabled() { return ordinaryBrowserEnabled },
  rendererHeader: Object.freeze({
    name: 'x-dsh-desktop-renderer',
    value: Buffer.alloc(32, 2).toString('base64url'),
  }),
  setOrdinaryBrowserEnabled(enabled) { ordinaryBrowserEnabled = enabled },
})
const LAN_HTTPS_SNAPSHOT = Object.freeze({
  state: 'inactive',
  actualPort: null,
  addresses: Object.freeze([]),
  caFingerprint: null,
  errorCode: null,
})
const LAN_HTTPS = Object.freeze({
  caCertificate: null,
  attach() {},
  snapshot() { return LAN_HTTPS_SNAPSHOT },
  async setEnabled() { return LAN_HTTPS_SNAPSHOT },
  async stop() { return LAN_HTTPS_SNAPSHOT },
})
const home = mkdtempSync(join(tmpdir(), 'dsh-desktop-profile-'))
let ctx
let releasePackageResolver
let pnpmRuntime
let mountedSpec
let nativeThemeSource = 'system'
const trayItems = []

try {
  // Desktop startup settings live in the profile patch document, not in a
  // settings file: prepare the profile once to create its directory, seed the
  // rows this smoke selects, then compose it again. The development-only profile
  // reload row is off because the smoke clears `loader.internal` exactly as the
  // packaged Electron Host does, which `@deepseek-ai/dsh-hmr` requires.
  const seeded = prepareDesktopProfile('1', home, 'win32')
  writeFileSync(join(seeded.profile.dir, PROFILE_PATCH_FILENAME), [
    '- id: dsh-desktop',
    `  name: ${DESKTOP_PACKAGE_NAME}/settings`,
    '  config:',
    '    mode: advanced',
    '- id: hmr',
    '  disabled: true',
    '',
  ].join('\n'))
  const aaRequested = process.env.DSH_VERIFY_AA === '1'
  const brokenAa = process.env.DSH_VERIFY_AA_BROKEN === '1'
  if (brokenAa) {
    const brokenPackage = join(seeded.profile.dir, 'node_modules', '@agents-anywhere', 'dsh-bridge-next')
    mkdirSync(brokenPackage, { recursive: true })
    writeFileSync(join(brokenPackage, 'package.json'), JSON.stringify({
      name: '@agents-anywhere/dsh-bridge-next', version: '99.0.0',
      dsh: { bundle: { patch: './missing.patch.yml' } },
    }))
  }
  const prepared = prepareDesktopProfile('1', home, 'win32', undefined, undefined, undefined, { aaEnabled: aaRequested })
  if (brokenAa && (!prepared.aaFailure || prepared.aaEnabled)) throw new Error('Broken AA bundle did not fail closed')
  const hostServicePluginDir = join(
    prepared.profile.dir,
    'node_modules',
    HOST_SERVICE_PLUGIN_NAME,
  )
  mkdirSync(join(prepared.profile.dir, 'node_modules'), { recursive: true })
  cpSync(
    fileURLToPath(new URL('../tests/fixtures/desktop-host-services-smoke-plugin/', import.meta.url)),
    hostServicePluginDir,
    { recursive: true, force: false, errorOnExist: true },
  )
  const patches = [
    // Deliberately compose the consumer before the desktop-pnpm provider row.
    // Its required injection must keep it pending until that service mounts.
    {
      insert: [{
        id: 'desktop-host-services-smoke-plugin',
        name: HOST_SERVICE_PLUGIN_NAME,
      }],
    },
    ...prepared.patches,
    // Keep this headless probe independent of the operator's AA account.
    ...(prepared.aaEnabled ? [{ id: 'agents-anywhere-bridge-next', config: {
      dshHome: home, stateRoot: join(home, 'aa-smoke-state'),
    } }] : []),
  ]
  const packageRoot = new URL('../', import.meta.url)
  const pnpmBinPath = fileURLToPath(new URL('node_modules/pnpm/bin/pnpm.mjs', packageRoot))
  const electronVersion = JSON.parse(
    readFileSync(new URL('node_modules/electron/package.json', packageRoot), 'utf8'),
  ).version
  pnpmRuntime = installDesktopPnpmRuntime({
    platform: process.platform,
    appExecutable: process.execPath,
    pnpmBinPath,
    electronVersion,
    stateDir: join(home, 'runtime-commands'),
    environment: process.env,
  })
  releasePackageResolver = installProfilePackageResolver(prepared.bareModuleBaseUrl)
  const runtime = {
    platform: 'win32',
    windowsBuild: 22_631,
    locale: 'en',
    updates: {
      isPackaged: false,
      canDownload: true,
      currentVersion: '2.0.0',
      statePath: join(home, 'update-state.json'),
      request: async () => { throw new Error('profile smoke must not perform update requests') },
      confirmDownload: async () => false,
      reportDownloadFailure: async () => {},
      showManualCheckResult: async () => {},
      downloadAndOpen: async () => {},
      notify: () => {},
    },
    schedule(spec) {
      mountedSpec = spec
      return async () => {}
    },
    async mountScheduled() {
      if (mountedSpec === undefined) throw new Error('desktop shell was not registered')
      runtime.setLocalePreference(mountedSpec.readLocalePreference())
      nativeThemeSource = mountedSpec.readThemeSource()
    },
    show() {},
    registerTrayItem(item) {
      trayItems.push(item)
      return {
        refresh() {},
        dispose() {
          const index = trayItems.indexOf(item)
          if (index >= 0) trayItems.splice(index, 1)
        },
      }
    },
    openTerminal() {},
    setLocalePreference(preference) { runtime.locale = preference ?? 'en' },
    setThemeSource(source) { nativeThemeSource = source },
    async requestRestart() {},
    prepareToQuit() {},
  }
  ctx = await boot(
    BIN_NAME,
    prepared.rootConfig,
    patches,
    async (host) => {
      // Match the public resolver path used by packaged Electron.
      host.loader.internal = undefined
      // 0.1.7 gates the profile-backed rows (`settings`, `config-editor`,
      // `plugin-manager`, `hmr`) behind the launcher's profile context: without
      // it the desktop shell waits forever on the `settings` service. Publish
      // the same facts `dsh` publishes for a profile launch.
      host.provide('profileContext', {
        name: DESKTOP_PROFILE_NAME,
        dir: prepared.profile.dir,
        patchPath: prepared.profile.patchPath,
        installAnchor: desktopInstallAnchor(),
        cwd: process.cwd(),
        home,
        startedBundles: prepared.profile.layers.map(layer => layer.packageName),
        overlays: [],
        telemetryDisabledEnv: process.env.DSH_TELEMETRY_DISABLED,
      })
      host.provide(DSH_LAUNCH_ENVIRONMENT_KEY, createLaunchEnvironmentSnapshot([]))
      host.provide('desktopBrowserAccess', BROWSER_ACCESS)
      host.provide('desktopLanHttps', LAN_HTTPS)
      host.provide('desktopRuntime', runtime)
      host.provide('desktopPnpmBootstrap', {
        activeProfileName: 'desktop',
        activeProfileDir: prepared.profile.dir,
        homeDir: prepared.homeDir,
        appExecutable: process.execPath,
        pnpmBinPath,
        electronVersion,
        nodeBinDir: pnpmRuntime.nodeBinDir,
        nodeShimPath: pnpmRuntime.nodeShimPath,
        clearEnvironmentPath: pnpmRuntime.clearEnvironmentPath,
        dshBootstrapPath: fileURLToPath(new URL('../lib/desktop-cli.js', import.meta.url)),
      })
      await host.plugin(DesktopProfileService, {
        current: {
          name: 'desktop',
          dir: prepared.profile.dir,
        },
        list: () => [{
          name: 'desktop',
          dir: prepared.profile.dir,
          exists: true,
          bundles: prepared.profile.layers.map(layer => layer.packageName),
          webCapable: true,
        }],
        persistSelection: () => {},
        requestRestart: () => {},
      })
      provideCmdline(host, {
        args: ['--host', '127.0.0.1', '--port', '0'],
        exit: () => {},
      })
    },
    prepared.bareModuleBaseUrl,
  )
  await runtime.mountScheduled()

  if (ctx.get('desktopPnpm') === undefined) {
    throw new Error('assembled desktop profile is missing the desktop pnpm Host capability')
  }
  if (ctx.desktopProfiles.current.name !== 'desktop'
    || ctx.desktopProfiles.current.dir !== prepared.profile.dir) {
    throw new Error('assembled desktop profile service has the wrong active identity')
  }
  // 0.1.7 replaced the `dsh-agent-presets` settings namespace with the
  // `@deepseek-ai/dsh-agent-preset-registry` roster. The web-app bundle inserts
  // the registry with `default: standard` and declares the shipped presets as
  // separate rows, so the deployment default is the built-in `standard`.
  const agentPresets = ctx.get('agentPresets')
  if (agentPresets === undefined) {
    throw new Error('assembled Windows profile is missing the agent preset roster')
  }
  const presetIds = (await agentPresets.list()).map(preset => preset.id)
  if (!presetIds.includes('minimal') || !presetIds.includes('standard')) {
    throw new Error(`assembled Windows profile exposes unexpected presets: ${presetIds.join(', ')}`)
  }
  if (agentPresets.defaultId !== 'standard') {
    throw new Error(`assembled Windows profile selected unexpected default ${agentPresets.defaultId}`)
  }
  const minimalPreset = await agentPresets.resolve('minimal')
  if (minimalPreset.id !== 'minimal' || minimalPreset.broken !== undefined) {
    throw new Error(`assembled Windows profile cannot select the minimal preset: ${JSON.stringify(minimalPreset)}`)
  }
  const hostServiceProbe = ctx.get(HOST_SERVICE_PROBE_KEY)
  if (hostServiceProbe?.current?.name !== 'desktop'
    || hostServiceProbe.current.dir !== prepared.profile.dir
    || hostServiceProbe.pnpm?.serviceName !== 'desktopPnpm'
    || hostServiceProbe.pnpm.lookupRun !== 'function'
    || hostServiceProbe.pnpm.run !== 'function') {
    throw new Error(
      `profile-local Host service plugin produced an unexpected probe: ${JSON.stringify(hostServiceProbe)}`,
    )
  }

  // Shipped product plugins ride the launcher generation. 1.5.3 dropped the
  // bundled Universal Robots plugin, so this launcher generation must not
  // register its `ur_*` tools; a re-added loader row fails here.
  const tools = ctx.get('tools')
  if (tools === undefined) {
    throw new Error('assembled desktop profile is missing the tool registry')
  }
  if (tools.get('ur_connect') !== undefined || tools.get('ur_ping') !== undefined) {
    throw new Error('assembled desktop profile registered the retired Universal Robots tools')
  }

  const picker = ctx.directoryPicker.capability()
  if (picker.kind !== 'browse') {
    throw new Error(`assembled Windows profile selected ${picker.kind} directory picker`)
  }
  const listing = await picker.list(home)
  if (listing.path !== home) {
    throw new Error(`assembled Windows browse picker listed ${listing.path} instead of ${home}`)
  }

  const expectedUrl = `http://127.0.0.1:${String(ctx.webServer.port)}/?dsh-desktop-mode=advanced&dsh-desktop-platform=win32&dsh-desktop-version=2.0.0&dsh-desktop-material=off&dsh-desktop-mica=1`
  if (mountedSpec?.url !== expectedUrl) {
    throw new Error(`desktop plugin produced an unexpected renderer URL: ${String(mountedSpec?.url)}`)
  }
  if (mountedSpec?.mode !== 'advanced') {
    throw new Error(`desktop plugin produced an unexpected shell mode: ${String(mountedSpec?.mode)}`)
  }
  if (mountedSpec?.rendererAccessHeader !== BROWSER_ACCESS.rendererHeader) {
    throw new Error('assembled profile did not preserve the launcher browser capability')
  }
  if (nativeThemeSource !== 'system') {
    throw new Error(`desktop plugin produced an unexpected native theme source: ${nativeThemeSource}`)
  }
  // 0.1.7 dropped the settings file: `ctx.get('settings')` is the SettingsForms
  // service with no `get(ns)` accessor, so the effective mode is read through
  // the same descriptor query the desktop settings module itself uses.
  if (readDesktopSettings(ctx).mode !== 'advanced') {
    throw new Error('assembled Host settings are missing the advanced dsh-desktop mode')
  }
  if (!trayItems.some(item => item.label() === 'Check for Updates…')) {
    throw new Error('assembled desktop profile is missing the update tray command')
  }
  if (process.platform !== 'linux'
    && !trayItems.some(item => item.label() === 'Open DSH Terminal')) {
    throw new Error('assembled desktop profile is missing the terminal tray command')
  }
  const profileMenu = trayItems.find(item => item.label() === 'Profile: desktop')
  if (profileMenu?.submenu?.()[0]?.label() !== 'desktop') {
    throw new Error('assembled desktop profile is missing the active profile tray submenu')
  }
  const unauthenticated = await fetch(expectedUrl, {
    headers: {
      [BROWSER_ACCESS.rendererHeader.name]: BROWSER_ACCESS.rendererHeader.value,
    },
  })
  await unauthenticated.body?.cancel()
  if (unauthenticated.status !== 401) {
    throw new Error(
      `assembled Web root accepted a renderer without browser authentication: HTTP ${String(unauthenticated.status)}`,
    )
  }
  if (typeof mountedSpec?.authenticationUrl !== 'string') {
    throw new Error('desktop plugin did not provide an authentication URL')
  }
  const authenticationUrl = new URL(mountedSpec.authenticationUrl)
  const rendererUrl = new URL(expectedUrl)
  const authenticationTokens = authenticationUrl.searchParams.getAll('token')
  if (authenticationUrl.origin !== rendererUrl.origin
    || authenticationUrl.pathname !== '/'
    || authenticationUrl.hash !== ''
    || [...authenticationUrl.searchParams.keys()].some(key => key !== 'token')
    || authenticationTokens.length !== 1
    || !/^[A-Za-z0-9_-]{43}$/u.test(authenticationTokens[0])) {
    throw new Error(`desktop plugin produced an invalid authentication URL: ${authenticationUrl.href}`)
  }
  const exchange = await fetch(authenticationUrl, {
    headers: {
      [BROWSER_ACCESS.rendererHeader.name]: BROWSER_ACCESS.rendererHeader.value,
    },
    redirect: 'manual',
  })
  await exchange.body?.cancel()
  // 0.1.7 answers with the directory-relative clean `./`, which resolves to the
  // root of the exchange URL rather than the literal `/` the 0.1.5 flow sent.
  const exchangeLocation = exchange.headers.get('location')
  const exchangeRedirect = exchangeLocation === null
    ? undefined
    : new URL(exchangeLocation, authenticationUrl)
  if (exchange.status !== 303
    || exchangeRedirect?.origin !== rendererUrl.origin
    || exchangeRedirect.pathname !== '/'
    || exchangeRedirect.hash !== '') {
    throw new Error(
      `browser authentication exchange returned HTTP ${String(exchange.status)} to ${String(exchangeLocation)} instead of a root redirect`,
    )
  }
  const setCookie = exchange.headers.get('set-cookie')
  const cookie = setCookie?.split(';', 1)[0]
  if (cookie === undefined || cookie.length === 0) {
    throw new Error('browser authentication exchange did not mint a cookie')
  }
  const response = await fetch(expectedUrl, {
    headers: {
      [BROWSER_ACCESS.rendererHeader.name]: BROWSER_ACCESS.rendererHeader.value,
      Cookie: cookie,
    },
  })
  const html = await response.text()
  if (response.status !== 200) {
    throw new Error(`assembled Web root returned HTTP ${String(response.status)}`)
  }
  const bootMatch = html.match(/(?:window\.__DSH_BOOT__|globalThis\["__DSH_BOOT__"\]) = (\{.*?\})<\/script>/u)
  if (bootMatch?.[1] === undefined) {
    throw new Error('assembled Web root is missing window.__DSH_BOOT__')
  }
  const graph = JSON.parse(bootMatch[1])
  const ids = new Set(graph.entries.map(entry => entry.id))
  const aaEnabled = aaRequested && !brokenAa
  if (ids.has('@agents-anywhere/dsh-bridge-next') !== aaEnabled) throw new Error('AA client graph does not match explicit selection')
  if (aaEnabled) {
    // 0.1.7 publishes the bridge asynchronously: the runtime service appears
    // once the plugin's init resolves and only reaches `ready` after the local
    // connector server has bound its port and published the endpoint file.
    const aaDeadline = Date.now() + 60_000
    let aaRuntime
    while (aaRuntime === undefined && Date.now() < aaDeadline) {
      aaRuntime = ctx.get('agentsAnywhereRuntime')
      if (aaRuntime === undefined) await new Promise(resolve => setTimeout(resolve, 100))
    }
    if (aaRuntime === undefined) {
      throw new Error(
        'AA Host services did not activate in the actual Desktop profile: agentsAnywhereRuntime',
      )
    }
    if (!ctx.get('agentsAnywhereOnboarding')) {
      throw new Error(
        'AA Host services did not activate in the actual Desktop profile: agentsAnywhereOnboarding',
      )
    }
    let aaStatus = aaRuntime.status()
    while (aaStatus.state === 'starting' && Date.now() < aaDeadline) {
      await new Promise(resolve => setTimeout(resolve, 100))
      aaStatus = aaRuntime.status()
    }
    if (aaStatus.state !== 'ready') {
      throw new Error(
        `AA bridge never became ready: ${aaStatus.state} ${String(aaStatus.message)}`,
      )
    }
    const endpoint = join(home, 'agents-anywhere', 'bridge', 'endpoint.json')
    if (!existsSync(endpoint)) throw new Error('AA did not publish its native DSH home endpoint')
    const snapshot = await ctx.get('agentsAnywhereOnboarding').inspect()
    if (snapshot.account) throw new Error('A fresh Profile inherited an AA account')
  }
  for (const id of [
    'dsh-plugin-desktop-beta',
    '@deepseek-ai/dsh-client-file-upload',
    '@deepseek-ai/dsh-client-ui-conversation',
    '@deepseek-ai/dsh-client-ui-sidebar',
    '@deepseek-ai/dsh-client-ui-directory-picker-browse',
    'dsh-nonead-client-skin',
  ]) {
    if (!ids.has(id)) {
      throw new Error(
        `assembled advanced Web graph is missing ${id}; received ${[...ids].sort().join(', ')}`,
      )
    }
  }
  for (const id of [
    '@deepseek-ai/dsh-client-ui-layout',
    '@deepseek-ai/dsh-client-ui-directory-picker-native',
  ]) {
    if (ids.has(id)) throw new Error(`assembled advanced Web graph unexpectedly includes ${id}`)
  }
} finally {
  await ctx?.fiber.dispose()
  releasePackageResolver?.()
  pnpmRuntime?.dispose()
  rmSync(home, { recursive: true, force: true })
}
