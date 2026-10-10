import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { desktopApplicationIconFilename, desktopApplicationIconPath } from '../src/application-icon-path.ts'

describe('desktop application icon path', () => {
  it('selects the multi-resolution ICO on Windows and the platform PNG elsewhere', () => {
    expect(desktopApplicationIconFilename('win32')).toBe('app-icon.ico')
    expect(desktopApplicationIconFilename('darwin')).toBe('app-icon-mac.png')
    expect(desktopApplicationIconFilename('linux')).toBe('app-icon.png')
  })

  it('resolves the shipped icon inside the package build directory', () => {
    for (const platform of ['win32', 'darwin', 'linux'] as const) {
      const filename = desktopApplicationIconFilename(platform)
      const path = desktopApplicationIconPath(platform)
      expect(path.endsWith(join('build', filename)), path).toBe(true)
      // The launcher publishes this path before any window exists, so a missing export
      // would leave the Windows taskbar button blank instead of failing at packaging.
      expect(existsSync(path), path).toBe(true)
    }
  })
})
