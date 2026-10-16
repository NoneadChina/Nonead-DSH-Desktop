import { describe, expect, it, vi } from 'vitest'
import type { BundleInfo, ChangeResult } from '@deepseek-ai/dsh-plugin-manager'
import { MarketInstallService, type MarketPluginManager } from '../src/install/service.js'
import type { CatalogSnapshot } from '../src/contracts/index.js'

const source = {
  kind: 'github' as const,
  owner: 'example',
  repo: 'plugin',
  commit: '0123456789abcdef0123456789abcdef01234567',
  subdirectory: 'packages/plugin',
}
const target = 'github:example/plugin#0123456789abcdef0123456789abcdef01234567&path:/packages/plugin'
const profile = () => ({ name: 'desktop', dir: '/fixtures/profiles/desktop' })

function snapshot(): CatalogSnapshot {
  return {
    schemaVersion: '1.0.0',
    source: {
      sourceRecordId: 'source-1',
      providerId: 'provider.example',
      adapterId: 'market.standard-http-v1',
      registrationKind: 'user-added',
      fetchedAt: '2026-08-26T00:00:00.000Z',
      finalUrl: 'https://example.test/plugins',
    },
    items: [{
      id: 'example/plugin',
      name: 'Example Plugin',
      displayName: 'Example Plugin',
      summary: 'Pinned GitHub plugin',
      repository: { url: 'https://github.com/example/plugin', subdirectory: 'packages/plugin' },
      installSource: source,
      provenance: { sourceRecordId: 'source-1', providerId: 'provider.example', itemId: 'example/plugin' },
    }],
    page: {},
  }
}

function manager(installed: (spec: string) => ChangeResult) {
  const bundles: BundleInfo[] = []
  return {
    listBundles: vi.fn(async () => [...bundles]),
    listPlugins: vi.fn(async () => []),
    installBundle: vi.fn(async (spec: string) => {
      const result = installed(spec)
      if (result.bundle !== undefined) {
        bundles.push({
          name: result.bundle, official: false, availability: 'profile', enabled: true, installed: true,
          optional: false, removable: true, rows: [], overrides: [], ...(result.version === undefined ? {} : { version: result.version }),
        })
      }
      return result
    }),
    setBundleEnabled: vi.fn(),
    removeBundle: vi.fn(),
  } satisfies MarketPluginManager
}

describe('Market GitHub install target', () => {
  it('verifies the source first and installs the pinned, shell-free target through the official manager', async () => {
    const official = manager(spec => ({
      changed: true, application: 'applied', stage: 'enable', target: spec, bundle: 'dsh-plugin-git', version: '1.2.3',
    }))
    const verifier = {
      verify: vi.fn(async candidate => ({
        packageName: 'dsh-plugin-git',
        version: '1.2.3',
        source: candidate.source!,
      })),
    }
    const service = new MarketInstallService(profile, official, verifier)
    try {
      service.observeCatalog(snapshot())
      const preview = await service.previewInstall('source-1', 'example/plugin', new AbortController().signal)
      expect(preview).toMatchObject({ packageName: 'dsh-plugin-git', version: '1.2.3' })
      await expect(service.executePreview(preview.intent, new AbortController().signal)).resolves.toEqual({
        action: 'install', packageName: 'dsh-plugin-git', version: '1.2.3', application: 'applied',
      })
      expect(official.installBundle.mock.calls).toEqual([[target, { enabled: true, saveExact: true }]])
      expect(verifier.verify).toHaveBeenCalledWith(expect.objectContaining({ source }), expect.any(AbortSignal))
      await expect(service.listInstallations(new AbortController().signal)).resolves.toMatchObject([
        { packageName: 'dsh-plugin-git', version: '1.2.3', enabled: true },
      ])
    } finally {
      service.dispose()
    }
  })

  it('reports a package whose manifest names something other than the verified plugin', async () => {
    const official = manager(spec => ({
      changed: true, application: 'applied', stage: 'enable', target: spec, bundle: 'dsh-plugin-impostor', version: '9.9.9',
    }))
    const service = new MarketInstallService(profile, official, {
      verify: vi.fn(async candidate => ({ packageName: 'dsh-plugin-git', version: '1.2.3', source: candidate.source! })),
    })
    try {
      service.observeCatalog(snapshot())
      const preview = await service.previewInstall('source-1', 'example/plugin', new AbortController().signal)
      await expect(service.executePreview(preview.intent, new AbortController().signal)).rejects.toMatchObject({
        code: 'operation-failed',
        details: 'expected dsh-plugin-git, installed dsh-plugin-impostor',
      })
    } finally {
      service.dispose()
    }
  })
})
