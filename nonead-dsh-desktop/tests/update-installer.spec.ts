import { expect, it, vi } from 'vitest'
vi.mock('electron', () => ({ autoUpdater: { on: vi.fn() } }))
import { assertNextMacBundle, assertNextWindowsInstaller, nextInstallerArguments } from '../src/update-installer.ts'

it('rejects Stable/Beta installers and an unexpected release even when the archive is valid', () => {
  expect(() => assertNextMacBundle('ai.deepseek.dsh.desktop', { name: 'nonead-dsh-desktop', version: '2.0.14-next' }, '2.0.14-next')).not.toThrow()
  expect(() => assertNextMacBundle('ai.deepseek.dsh.desktop.beta', { name: 'nonead-dsh-desktop', version: '2.0.14-next' }, '2.0.14-next')).toThrow()
  expect(() => assertNextMacBundle('ai.deepseek.dsh.desktop', { name: 'nonead-dsh-desktop', version: '2.0.13-next' }, '2.0.14-next')).toThrow()
  expect(() => assertNextWindowsInstaller({ ProductName: 'Nonead DSH Desktop', ProductVersion: '2.0.14-next' }, '2.0.14-next')).not.toThrow()
  expect(() => assertNextWindowsInstaller({ ProductName: 'DSH Desktop Beta', ProductVersion: '2.0.14-next' }, '2.0.14-next')).toThrow()
})

it('launches the Windows installer visibly in update mode', () => {
  const args = nextInstallerArguments('win32')
  expect(args).toContain('--updated')
  // `/S` silences the whole run, which made a working install look like nothing started.
  expect(args).not.toContain('/S')
})

it('passes no installer arguments on other platforms', () => {
  expect(nextInstallerArguments('darwin')).toEqual([])
  expect(nextInstallerArguments('linux')).toEqual([])
})
