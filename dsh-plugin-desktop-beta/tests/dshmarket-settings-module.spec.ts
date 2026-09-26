import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

// The bundled market inlines the settings wiring it used to import from
// `@deepseek-ai/dsh-settings` (see the module header of `lib/settings.js`), so loading it must
// stay free of module-evaluation errors even as the host settings service changes shape.
describe('bundled market settings module', () => {
  it('instantiates the legacy market settings module', async () => {
    const require = createRequire(import.meta.url)
    const manifest = require.resolve('dshmarket/package.json')
    const settingsUrl = pathToFileURL(join(dirname(manifest), 'lib', 'settings.js')).href
    const loaded = await import(settingsUrl) as {
      MARKET_SETTINGS_NS: string
      installMarketSettings: unknown
    }

    expect(String(loaded.MARKET_SETTINGS_NS)).toBe('dsh-market')
    expect(loaded.installMarketSettings).toBeTypeOf('function')
  })
})
