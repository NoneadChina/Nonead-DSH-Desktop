import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DESKTOP_INSTALLER_QUIT_FLAG } from '../src/desktop-installer-quit.ts'

describe('Windows NSIS running-app handoff', () => {
  it('runs the close-app hook from customInit, before any page is shown', () => {
    const script = readFileSync(join(process.cwd(), 'build', 'installer.nsh'), 'utf8')
    const closeMacro = script.indexOf('!macro dshInstallerCloseRunningApp')
    const initHook = script.indexOf('!macro customInit')

    expect(script).toContain('!ifndef BUILD_UNINSTALLER')
    expect(closeMacro).toBeGreaterThanOrEqual(0)
    // The hook must be defined before electron-builder reaches installer.nsi:80, and the
    // macro body must be the close-app routine, not a prompt.
    expect(initHook).toBeGreaterThan(closeMacro)
    expect(script.slice(initHook)).toContain('!insertmacro dshInstallerCloseRunningApp')
    expect(script).toContain('!insertmacro dshInstallerFindApp')
    expect(script).toContain(DESKTOP_INSTALLER_QUIT_FLAG)
    expect(script).toContain('$INSTDIR\\${APP_EXECUTABLE_FILENAME}')
  })

  it('closes the previous version instead of offering to skip it', () => {
    const script = readFileSync(join(process.cwd(), 'build', 'installer.nsh'), 'utf8')

    // Bounded orderly window, then a forced-close loop with both soft and hard attempts.
    expect(script).toContain('$DshWaitCount < 20')
    expect(script).toContain('Sleep 500')
    expect(script).toContain('$DshWaitCount < 6')
    expect(script).toContain('!insertmacro dshInstallerKillApp 0')
    expect(script).toContain('!insertmacro dshInstallerKillApp 1')
    expect(script).toContain('Stop-Process -Force')
    expect(script).toContain('taskkill /IM "${APP_EXECUTABLE_FILENAME}" /F')
    // Detection must not depend on PowerShell alone: tasklist covers hosts where Get-Process
    // cannot read the path of another user's process.
    expect(script).toContain('tasklist /FI "IMAGENAME eq ${APP_EXECUTABLE_FILENAME}"')

    // Nothing may let the install continue while the previous version still runs.
    expect(script).not.toContain('MB_OKCANCEL')
    expect(script).not.toContain('MB_RETRYCANCEL')
    expect(script).toContain('MessageBox MB_ICONSTOP')
    expect(script).toContain('SetErrorLevel 2')
    expect(script).toContain('Quit')

    // The stock customCheckAppRunning prompt implementation must not be compiled in.
    const checkHook = script.indexOf('!macro customCheckAppRunning')
    expect(checkHook).toBeGreaterThan(0)
    const checkBody = script.slice(checkHook + '!macro customCheckAppRunning'.length)
    expect(checkBody.slice(0, checkBody.indexOf('!macroend'))).not.toContain('MessageBox')
  })

  it('keeps the throwaway uninstaller stub buildable on a machine running the app', () => {
    const script = readFileSync(join(process.cwd(), 'build', 'installer.nsh'), 'utf8')

    // Everything except the (deliberately empty) customCheckAppRunning hook is compiled only
    // for the real installer; the release machine runs this app while the stub is built.
    expect(script).toContain('!ifndef BUILD_UNINSTALLER')
    expect(script).not.toContain('nsProcess::KillProcess')
    expect(script).not.toContain('getProcessInfo.nsh')
  })
})
