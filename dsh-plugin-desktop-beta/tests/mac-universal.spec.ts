import { join, resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  MACOS_UNIVERSAL_NATIVE_ENTRIES,
  prepareMacUniversalRuntime,
} from '../scripts/mac-universal.ts'
import { pinnedElectronAbi } from '../scripts/electron-abi.ts'
import { REQUIRED_POSIX_FS_EXT_ENTRIES } from '../scripts/verify-packaged-runtime.ts'

describe('universal macOS native runtime preparation', () => {
  it('tracks the pinned Electron fs-ext binding for both CPU architectures', () => {
    const binding = `electron.abi${pinnedElectronAbi()}.node`
    expect(MACOS_UNIVERSAL_NATIVE_ENTRIES).toEqual(expect.arrayContaining([
      {
        arch: 'arm64',
        path: `node_modules/fs-ext/prebuilds/darwin-arm64/${binding}`,
      },
      {
        arch: 'x86_64',
        path: `node_modules/fs-ext/prebuilds/darwin-x64/${binding}`,
      },
    ]))
  })

  it('pins the fs-ext binding to the ABI of the installed Electron release', () => {
    // The binding name must match both what `prepare-fs-ext.ts` writes and what
    // the fs-ext patch resolves at run time, so a stale literal would otherwise
    // make macOS and Linux packaging fail after the build with a "missing native
    // file(s)" error. Electron 44 moved this number from 148 to 149.
    const abi = pinnedElectronAbi()
    const binding = `electron.abi${abi}.node`
    const fsExtPaths = MACOS_UNIVERSAL_NATIVE_ENTRIES
      .map(entry => entry.path)
      .filter(path => path.includes('/fs-ext/'))
    expect(fsExtPaths).toEqual([
      `node_modules/fs-ext/prebuilds/darwin-arm64/${binding}`,
      `node_modules/fs-ext/prebuilds/darwin-x64/${binding}`,
    ])
    // The non-universal macOS/Linux inventory must agree with the same source.
    expect(Object.values(REQUIRED_POSIX_FS_EXT_ENTRIES).flatMap(entries => Object.values(entries)))
      .toEqual([
        `node_modules/fs-ext/prebuilds/darwin-x64/${binding}`,
        `node_modules/fs-ext/prebuilds/darwin-arm64/${binding}`,
        `node_modules/fs-ext/prebuilds/linux-x64/${binding}`,
        `node_modules/fs-ext/prebuilds/linux-arm64/${binding}`,
      ])
  })

  it('requires every CPU-specific file and repairs both node-pty helpers', () => {
    const chmod = vi.fn()
    const desktopRoot = resolve('/desktop')

    prepareMacUniversalRuntime({ desktopRoot, exists: () => true, chmod })

    expect(chmod.mock.calls).toEqual([
      [join(desktopRoot, 'node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper'), 0o755],
      [join(desktopRoot, 'node_modules/node-pty/prebuilds/darwin-x64/spawn-helper'), 0o755],
    ])
  })

  it('fails before changing permissions when one architecture is incomplete', () => {
    const chmod = vi.fn()
    const desktopRoot = resolve('/desktop')
    const missing = MACOS_UNIVERSAL_NATIVE_ENTRIES.at(-1)!.path

    expect(() => prepareMacUniversalRuntime({
      desktopRoot,
      exists: path => path !== join(desktopRoot, missing),
      chmod,
    })).toThrow(join(desktopRoot, missing))
    expect(chmod).not.toHaveBeenCalled()
  })
})
