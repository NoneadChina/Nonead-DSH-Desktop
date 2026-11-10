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
    // $R1 rather than a declared Var: the throwaway stub would leave a Var "never set".
    expect(script).toContain('$R1 < 20')
    expect(script).toContain('Sleep 500')
    expect(script).toContain('$R1 < 6')
    expect(script).toContain('!insertmacro dshInstallerKillApp 0')
    expect(script).toContain('!insertmacro dshInstallerKillApp 1')
    expect(script).toContain('Stop-Process -Force')
    expect(script).toContain('taskkill /IM "${APP_EXECUTABLE_FILENAME}" /F')
    // Detection must not depend on PowerShell alone: tasklist covers hosts where Get-Process
    // cannot read the path of another user's process.
    expect(script).toContain('tasklist /FI "IMAGENAME eq ${APP_EXECUTABLE_FILENAME}"')

    // Nothing may let the install continue while the previous version still runs.
    const initHook = script.indexOf('!macro customInit')
    const initBody = script.slice(initHook, script.indexOf('!macroend', initHook))
    expect(initBody).not.toContain('MessageBox')
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

  it('asks before an uninstall closes a running instance, and aborts on cancel', () => {
    const script = readFileSync(join(process.cwd(), 'build', 'installer.nsh'), 'utf8')
    const guard = script.indexOf('!ifdef BUILD_UNINSTALLER')
    const uninstallHook = script.indexOf('!macro customUnInstall')

    expect(guard).toBeGreaterThan(0)
    expect(uninstallHook).toBeGreaterThan(guard)
    const body = script.slice(uninstallHook, script.indexOf('!macroend', uninstallHook))

    // A silent uninstall must never delete files out from under a live instance, and a quiet
    // one must never prompt: the prompt lives inside the "is running" branch.
    expect(body).toContain('${if} $R0 == 0')
    expect(body).toContain('MB_OKCANCEL|MB_ICONEXCLAMATION')
    expect(body).toContain('还在运行中')
    expect(body).toContain('IDOK dsh_uninstall_close_app')
    // /SD IDOK keeps a scripted (/S) uninstall from blocking on the prompt.
    expect(body).toContain('/SD IDOK')
    // Cancel aborts the uninstall instead of continuing to delete files.
    expect(body).toContain('Quit')
    // Confirm reuses the same orderly-then-forced close and then falls through to deletion.
    expect(body).toContain('!insertmacro dshInstallerCloseRunningApp')
  })
})
