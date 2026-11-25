/** Exercise Desktop continuation in the actual official frontend and Loader, in a temporary home. */
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { DesktopHostProcess } from '../lib/host-process.js'
import { NextProfiles } from '../lib/profiles.js'
import { authenticateWebHost, serveWebDocument } from '../lib/web-document.js'

// Renderer capability header. `lib/desktop-browser-access.js` is emitted under a content-hashed
// name, so the contract value is mirrored here instead of imported (`src/desktop-contract.ts`).
const RENDERER_ACCESS_HEADER = 'x-dsh-desktop-renderer'

const root = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(import.meta.url)
const webRoot = dirname(require.resolve('@deepseek-ai/dsh-web-frontend/dist/index.html'))
const home = mkdtempSync(join(tmpdir(), 'dsh-official-onboarding-'))
const profiles = new NextProfiles(home)
profiles.ensure('desktop')
profiles.setFeatures('desktop', { market: false, remoteControl: false })
// Exercise both fresh official progress and an already completed official flow.
// Desktop eligibility must not depend on either condition.
const officialPending = process.argv.includes('--official-pending')
writeFileSync(join(profiles.directory('desktop'), 'cordis.patch.yml'), JSON.stringify([
  { id: 'ui-settings-account', config: { step: officialPending ? 'welcome' : 'done', completion: officialPending ? null : 'skipped' } },
]), { mode: 0o600 })
// The Host reads its renderer credential from the private stdin pipe and gates ordinary browser
// traffic with it, so this harness mints one and hands it over exactly like the app does.
const credential = randomBytes(32).toString('base64url')
const host = new DesktopHostProcess(process.execPath, root, profiles.directory('desktop'), undefined,
  { ...process.env, DSH_HOME: home, DSH_TELEMETRY_DISABLED: '1' }, undefined, undefined, undefined, join(root, 'lib/host.js'),
  undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, credential)
const screenshots = join(root, '.nonead-dsh-desktop/verification')
mkdirSync(screenshots, { recursive: true })
let browser, page
let required = true, accountPending = false, rejectDismiss = true, rejectSave = false, rejectRead = true
const finishes = [], errors = []
const selection = { mode: 'compatibility', macosMaterial: 'off', windowsMaterial: 'off', openBrowser: false,
  networkExposure: 'loopback', market: 'community-market', aaEnabled: false,
  notifications: { enabled: true, notifyOnTurnCompletion: true, notifyOnTurnFailure: true, notifyOnJobCompletion: false, notifyOnJobFailure: false } }
try {
  const ready = await host.start()
  const origin = new URL(ready.url).origin
  const cookie = await authenticateWebHost(ready.url, credential), separator = cookie.indexOf('=')
  const document = await (await serveWebDocument(new Request('dsh-app://app/'), webRoot)).text()
  const browserChannel = process.env.DSH_NONEAD_TEST_BROWSER_CHANNEL ?? process.env.DSH_NEXT_TEST_BROWSER_CHANNEL
  browser = await chromium.launch({ headless: true, ...(browserChannel ? { channel: browserChannel } : {}) })
  const context = await browser.newContext({ viewport: { width: 1040, height: 720 }, locale: 'zh-CN', colorScheme: 'dark' })
  await context.grantPermissions(['local-network-access'], { origin })
  // Ordinary browser traffic is denied by the Host's browser-access gate, exactly as in the app;
  // the Electron renderer reaches the Host because its session attaches this capability header.
  await context.setExtraHTTPHeaders({ [RENDERER_ACCESS_HEADER]: credential })
  await context.addCookies([{ url: origin, name: cookie.slice(0, separator), value: cookie.slice(separator + 1) }])
  await context.route(origin + '/', route => route.fulfill({ contentType: 'text/html', body: document }))
  await context.exposeFunction('__boot', async () => ({ injections: await host.collectInjections(), streamBaseUrl: origin }))
  await context.exposeFunction('__bootFailed', message => { errors.push(message) })
  // A representative slice of the bundled catalogue: the last wizard page groups these by category
  // and the install view names each plugin and thanks its author.
  const bundled = [
    { name: 'dsh-context', version: '0.83.0', category: 'core', author: 'bowenliang123',
      description: '把上下文占用、压缩与回收集中在一个面板里，长对话也能看清来龙去脉。',
      descriptionEn: 'Context usage, compression and reclamation in one panel, so long conversations stay legible.' },
    { name: 'dsh-better-sidebar', version: '0.30.1', category: 'workspace', author: '社区贡献者',
      description: '文件树、编辑器、改动与任务收进一列侧边栏，工作区动线更短。',
      descriptionEn: 'File tree, editor, changes and tasks in one sidebar column, so the workspace is a shorter trip.' },
    { name: '@michengai/dsh-agency-agents', version: '1.2.27', category: 'agent', author: 'MichengAI',
      description: '内置 331 位可召唤的领域专家，按分工挑选，不必每次从零描述。',
      descriptionEn: '331 summonable domain experts, picked by remit instead of described from scratch.' },
    { name: 'dsh-nonead-ursim', version: '0.3.14', category: 'robot', author: '拓德科技',
      description: 'UR 机械臂的离线仿真，没有真机也能先把轨迹跑一遍。',
      descriptionEn: 'Offline UR arm simulation, so trajectories can be rehearsed without hardware.' },
  ]
  await context.exposeFunction('__readSetup', () => {
    if (rejectRead) { rejectRead = false; throw new Error('Fixture: setup state unavailable') }
    return { required, accountPending, edition: 'next', profile: 'desktop', computerUse: false, bundledPlugins: bundled,
      input: { ...selection, appVersion: '2.0.14-next', platform: 'darwin', profileName: 'desktop' } }
  })
  await context.exposeFunction('__finishSetup', (profile, value) => {
    if (rejectSave) { rejectSave = false; throw new Error('Fixture: could not save Profile') }
    finishes.push({ profile, selection: value }); required = false; accountPending = value !== undefined
  })
  await context.exposeFunction('__dismissAccount', profile => {
    assert.equal(profile, 'desktop')
    if (rejectDismiss) { rejectDismiss = false; throw new Error('Fixture: account choice save failed') }
    accountPending = false
  })
  await context.addInitScript(() => {
    globalThis.dshDesktop = { protocolVersion: 1 }
    globalThis.dshDesktopBoot = { ready: () => globalThis.__boot(), failed: message => globalThis.__bootFailed(message) }
    globalThis.dshDesktopSetup = { read: () => globalThis.__readSetup(), finish: (profile, value) => globalThis.__finishSetup(profile, value), dismissAccount: profile => globalThis.__dismissAccount(profile) }
  })
  // The packaged app's preload exposes `desktopNext`; the wizard reads the bundled catalogue from it.
  await context.addInitScript(list => {
    globalThis.desktopNext = { state: async () => ({ bundledPlugins: list }) }
  }, bundled)
  page = await context.newPage(); page.setDefaultTimeout(20_000)
  page.on('pageerror', error => errors.push(error.stack ?? error.message))
  const surface = page.locator('[data-desktop-onboarding="desktop-extension"]')
  const captureAccount = async name => {
    await page.evaluate(async () => {
      await Promise.all(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map(animation => animation.finished.catch(() => {})))
    })
    await page.screenshot({ path: join(screenshots, name) })
  }
  const navigate = async (name, delta) => {
    const current = Number(await surface.locator('[data-page]').getAttribute('data-page'))
    const target = String(current + delta)
    // A dialog that is still closing can swallow the first click, so confirm the wizard actually
    // moved to the target page instead of trusting a transient render of it.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      // A dialog that is still animating out leaves `pointer-events: none` on the body, so the
      // click lands nowhere. Wait for the exit to finish before pressing.
      await page.waitForFunction(() => getComputedStyle(document.body).pointerEvents !== 'none', undefined, { timeout: 5_000 }).catch(() => {})
      await surface.getByRole('button', { name }).click()
      const moved = await page.waitForFunction(expected =>
        document.querySelector('[data-desktop-onboarding="desktop-extension"] [data-page]')?.getAttribute('data-page') === expected,
      target, { timeout: 5_000 }).then(() => true, () => false)
      if (moved) return
    }
    await surface.locator(`[data-page="${target}"]`).waitFor()
  }
  const next = () => navigate(/^(下一步|Continue)$/, 1)
  // The final page animates its footer in, so a role-based click can time out on a button that the
  // DOM already exposes (hidden elements are skipped by role queries). Press it through the DOM.
  const press = async (labels, timeout = 20_000) => {
    const deadline = Date.now() + timeout
    while (Date.now() < deadline) {
      const clicked = await page.evaluate(names => {
        const scope = document.querySelector('[data-desktop-onboarding="desktop-extension"]')
        const button = [...(scope?.querySelectorAll('button') ?? [])]
          .find(item => names.includes((item.textContent ?? '').trim()))
        if (!button || button.disabled) return false
        button.click()
        return true
      }, labels)
      if (clicked) return
      await page.waitForTimeout(200)
    }
    const observed = await page.evaluate(() => ({
      surfaces: document.querySelectorAll('[data-desktop-onboarding="desktop-extension"]').length,
      page: document.querySelector('[data-desktop-onboarding="desktop-extension"] [data-page]')?.getAttribute('data-page'),
      buttons: [...document.querySelectorAll('[data-desktop-onboarding="desktop-extension"] button')].map(item => (item.textContent ?? '').trim()),
      alerts: [...document.querySelectorAll('[data-desktop-onboarding="desktop-extension"] [role="alert"]')].map(item => (item.textContent ?? '').trim()),
    }))
    throw new Error(`verify-onboarding: none of ${labels.join('/')} is available (${JSON.stringify(observed)})`)
  }
  const finish = () => press(['完成并开始', 'Finish and start'])
  const skip = () => press(['跳过', 'Skip'])
  const back = () => navigate(/^(上一步|Back)$/, -1)
  const open = async () => {
    await page.goto(origin); await surface.waitFor()
    // Activate native macOS CSS after the browser-only Host boot (which has no
    // native shortcut service). Click tests alone do not cover app drag regions.
    await page.evaluate(() => { document.documentElement.dataset.platform = 'darwin' })
  }
  await open()
  await surface.getByRole('alert').filter({ hasText: 'setup state unavailable' }).waitFor()
  await surface.getByRole('button', { name: /^(重试|Retry)$/ }).first().click()
  await surface.locator('[data-page="0"]').waitFor()
  assert.notEqual(await surface.evaluate(element => getComputedStyle(element).getPropertyValue('--spacing').trim()), '')
  assert.match(await surface.locator('h1').innerText(), /Nonead DSH Desktop/)
  assert.equal(await page.locator('#root').evaluate(element => element.inert), true)
  await page.screenshot({ path: join(screenshots, 'onboarding-official-welcome.png') })
  await next()
  const backBounds = await surface.getByRole('button', { name: /^(上一步|Back)$/ }).boundingBox()
  const progressBounds = await surface.locator('.next-onboarding-progress').boundingBox()
  const mainBounds = await surface.locator('main').boundingBox()
  assert.ok(progressBounds.y >= 36 && progressBounds.y + progressBounds.height <= mainBounds.y, 'Progress belongs above the content, clear of traffic lights')
  assert.ok(backBounds.y >= mainBounds.y + mainBounds.height, 'Official Back navigation belongs below the content')
  for (const element of await surface.locator('.next-onboarding-choice, [role="radio"]').all()) {
    assert.equal(await element.evaluate(node => getComputedStyle(node).getPropertyValue('-webkit-app-region')), 'no-drag', 'Choice cards and radio controls must subtract the official drag region')
  }
  await surface.getByText('dsh-market', { exact: true }).click()
  await page.screenshot({ path: join(screenshots, 'onboarding-official-market-macos.png') })
  await next()
  await surface.getByRole('switch').check()
  assert.equal(await surface.getByRole('switch').evaluate(node => getComputedStyle(node).getPropertyValue('-webkit-app-region')), 'no-drag')
  assert.equal(await surface.locator('img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0)), true)
  await back()
  assert.equal(await surface.getByRole('radio', { name: 'dsh-market', exact: true }).isChecked(), true)
  await next()
  assert.equal(await surface.getByRole('switch').isChecked(), true)
  await next()
  await surface.getByRole('switch').check()
  await surface.getByRole('button', { name: /^(权限设置|Permission settings)$/ }).click()
  const permissions = page.getByRole('dialog', { name: /^(系统权限|System permissions)$/ })
  await permissions.waitFor()
  await permissions.getByRole('button', { name: /^(关闭|Close)$/ }).click()
  await permissions.waitFor({ state: 'hidden' })
  // The dialog keeps its exit layer mounted for a moment after `hidden`; a click sent inside that
  // window lands on the layer instead of the wizard's footer, so let the frame settle first.
  await page.waitForTimeout(1_500)
  await page.screenshot({ path: join(screenshots, 'onboarding-official-computer-use.png') })
  // The wizard has six pages (welcome, market, remote control, Computer Use, recovery, bundled
  // plugins), so advance until the final page offers to finish instead of assuming one more step.
  // The footer animates while the page transitions, so drive it through the DOM: an actionability
  // check can time out on a button that is mid-transition even though it is clickable.
  for (let step = 0; step < 8; step += 1) {
    const state = await page.evaluate(() => {
      const scope = document.querySelector('[data-desktop-onboarding="desktop-extension"]')
      const buttons = [...(scope?.querySelectorAll('button') ?? [])]
      const label = item => (item.textContent ?? '').trim()
      const finish = buttons.some(item => ['完成并开始', 'Finish and start'].includes(label(item)))
      const next = buttons.find(item => ['下一步', 'Continue'].includes(label(item)))
      if (!finish && next && !next.disabled) next.click()
      return { finish, clicked: !finish && next !== undefined }
    })
    if (state.finish) break
    await page.waitForTimeout(400)
  }
  // The last page must summarise the catalogue by category instead of listing every plugin.
  const categories = await surface.locator('.next-onboarding-category').evaluateAll(items => items.map(item => (item.textContent ?? '').trim()))
  assert.ok(categories.length >= 3, `bundled plugins are summarised by category (got ${String(categories.length)})`)
  assert.equal(await surface.locator('.next-onboarding-plugins').count(), 0, 'the full plugin list stays off the page')
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity)
      .map(animation => animation.finished.catch(() => {})))
  })
  await page.screenshot({ path: join(screenshots, 'onboarding-official-bundled-plugins.png') })
  rejectSave = true
  await finish()
  await surface.getByRole('alert').filter({ hasText: 'could not save Profile' }).waitFor()
  await finish()
  await surface.waitFor({ state: 'hidden' })
  assert.equal(finishes.length, 1)
  assert.deepEqual(finishes[0], { profile: 'desktop', selection: { ...selection, market: 'dsh-market', aaEnabled: true, computerUse: true } })
  // The native app restarts after saving. No authorization should start in the old renderer.
  await page.reload()
  await surface.getByRole('heading', { name: '桌面设置已完成' }).waitFor()
  await captureAccount('onboarding-official-account-choice.png')
  await surface.getByRole('button', { name: '访问 NONEAD', exact: true }).click()
  assert.equal(await surface.count(), 1)
  await surface.getByRole('button', { name: '暂时跳过', exact: true }).click()
  await surface.getByRole('alert').filter({ hasText: 'account choice save failed' }).waitFor()
  await surface.getByRole('button', { name: '重试', exact: true }).click()
  await surface.getByRole('button', { name: '暂时跳过', exact: true }).click()
  await surface.waitFor({ state: 'hidden' })
  assert.equal(await surface.count(), 0)
  assert.equal(accountPending, false)
  await page.reload()
  await page.getByRole('button', { name: /^(插件|Plugins)$/ }).waitFor()
  assert.equal(await surface.count(), 0)
  accountPending = true
  await page.reload()
  await surface.getByRole('button', { name: '暂时跳过', exact: true }).click()
  await surface.waitFor({ state: 'hidden' })
  assert.equal(accountPending, false)
  assert.equal(await page.locator('#root').evaluate(element => element.inert), false)
  required = true
  await open(); await next()
  await page.setViewportSize({ width: 680, height: 560 })
  const headingBounds = await surface.locator('h1').boundingBox()
  const footerBounds = await surface.locator('footer').boundingBox()
  assert.ok(headingBounds.y >= 0 && footerBounds.y + footerBounds.height <= 560)
  assert.equal(await surface.locator('h1').evaluate(heading => heading === document.activeElement), true)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.screenshot({ path: join(screenshots, 'onboarding-official-next-small.png') })
  await next(); await surface.getByRole('switch').check(); await skip()
  await surface.waitFor({ state: 'hidden' })
  assert.equal(finishes.at(-1).selection, undefined)
  assert.deepEqual(errors, [])
  console.log(`Original Next onboarding passed inside the official surface: independent native eligibility, official progress ${officialPending ? 'unfinished' : 'completed'}, state-read and save retries, five original pages, artwork, back navigation, choices, skip, completion, inert cleanup, and no repeat.`)
} catch (error) {
  console.error(errors)
  if (page) { console.error(await page.locator('body').innerText()); await page.screenshot({ path: join(screenshots, 'onboarding-failure.png') }).catch(() => {}) }
  throw error
} finally {
  await browser?.close()
  await host.stop()
  rmSync(home, { recursive: true, force: true })
}
