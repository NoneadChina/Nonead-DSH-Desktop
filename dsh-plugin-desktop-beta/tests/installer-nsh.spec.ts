import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DESKTOP_INSTALLER_QUIT_FLAG } from '../src/desktop-installer-quit.ts'

// LCIDs of the 8 installer languages (Windows locale ids, also what NSIS
// language files use - e.g. SimpChinese.nlf says LanguageID 2052). es_ES maps to
// SpanishInternational (3082) and pt_BR to PortugueseBR (1046), which is why the gate below
// compares LCIDs instead of language names.
const EIGHT_LANG_LCIDS = [1033, 2052, 1041, 3082, 1036, 1031, 1049, 1046]

// Both failure notices are split into title + hint, exactly like the Inno line's
// CannotCloseApp* / CannotCloseApp*Hint pair.
const CLOSE_APP_KEYS = [
  'dshCannotCloseAppInstall',
  'dshCannotCloseAppInstallHint',
  'dshCannotCloseAppUninstall',
  'dshCannotCloseAppUninstallHint',
]

function readInstallerScript(): string {
  return readFileSync(join(process.cwd(), 'build', 'installer.nsh'), 'utf8')
}

describe('Windows NSIS running-app handoff', () => {
  it('runs the close-app hook from customInit, before any page is shown', () => {
    const script = readInstallerScript()
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
    const script = readInstallerScript()

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
    const script = readInstallerScript()

    // Everything except the (deliberately empty) customCheckAppRunning hook is compiled only
    // for the real installer; the release machine runs this app while the stub is built.
    expect(script).toContain('!ifndef BUILD_UNINSTALLER')
    expect(script).not.toContain('nsProcess::KillProcess')
    expect(script).not.toContain('getProcessInfo.nsh')
  })

  it('uninstall closes a running instance directly and reports in the UI language on failure', () => {
    const script = readInstallerScript()
    const guard = script.indexOf('!ifdef BUILD_UNINSTALLER')
    const uninstallHook = script.indexOf('!macro customUnInstall')

    expect(guard).toBeGreaterThan(0)
    expect(uninstallHook).toBeGreaterThan(guard)
    const body = script.slice(uninstallHook, script.indexOf('!macroend', uninstallHook))

    // A silent uninstall must never delete files out from under a live instance: the close
    // attempt lives inside the "is running" branch. Like the Inno line, the close is
    // attempted directly - no OK/Cancel pre-prompt anymore.
    expect(body).toContain('${if} $R0 == 0')
    expect(body).not.toContain('MB_OKCANCEL')
    // Failure reports through the localized uninstall strings, not a hardcoded Chinese one.
    expect(body).toContain('`dshCannotCloseAppUninstall`')
    expect(body).toContain('`dshCannotCloseAppUninstallHint`')
    expect(script).not.toContain('还在运行中')

    // The refusal path inside the close macro takes the title/hint ids as arguments and
    // joins them with one line break, the shape Inno produces with #13#10.
    const closeHook = script.indexOf('!macro dshInstallerCloseRunningApp')
    expect(closeHook).toBeGreaterThan(0)
    const closeBody = script.slice(closeHook, script.indexOf('!macroend', closeHook))
    expect(closeBody).toContain('!macro dshInstallerCloseRunningApp _FAILTITLE _FAILHINT')
    expect(closeBody).toContain('$(${_FAILTITLE})$\\r$\\n$(${_FAILHINT})')
    // A silent install/uninstall must not hang on the notice; it still exits with code 2.
    expect(closeBody).toContain('/SD IDOK')
  })

  it('carries the close-app notices in all 8 installer languages', () => {
    const script = readInstallerScript()

    for (const key of CLOSE_APP_KEYS) {
      // Every language gets an explicit LangString line; English (1033) doubles as the
      // fallback for locales outside the 8.
      for (const lcid of EIGHT_LANG_LCIDS) {
        expect(script).toMatch(new RegExp(`^LangString ${key} +${lcid} `, 'm'))
      }
    }

    // Any CJK/Cyrillic content must live inside LangString lines - nowhere else may the
    // script hardcode a non-English UI string (the old uninstall prompt did).
    const lines = script.split(/\r?\n/)
    for (const line of lines) {
      if (/[\u4e00-\u9fff\u3040-\u30ff\u0400-\u04ff]/.test(line)) {
        expect(line.trim().startsWith('LangString')).toBe(true)
      }
    }

    // Texts reference the product by define, so a rename never strands stale wording.
    expect(script).toContain('Cannot close the running ${PRODUCT_NAME}."')
    // Title and hint stay separate keys, mirroring [CustomMessages] in the Inno line.
    expect(script).toContain('Quit it manually, then run this installer again."')
  })

  it('follows the Windows display language and only prompts when it is not among the 8', () => {
    const script = readInstallerScript()

    // The selector must NOT be the unconditional displayLanguageSelector behavior (that
    // would define DISPLAY_LANG_SELECTOR and prompt on every run). Our gate is a hook that
    // runs before installer.nsi's DISPLAY_LANG_SELECTOR branch - and it must carry the name
    // electron-builder actually inserts, `preInit` (installer.nsi:56). A differently named
    // macro compiles without ever running.
    expect(script).not.toContain('!define DISPLAY_LANG_SELECTOR')
    expect(script).not.toContain('customPreInit')
    const preInitHook = script.indexOf('!macro preInit')
    expect(preInitHook).toBeGreaterThan(0)
    const preInitBody = script.slice(preInitHook, script.indexOf('!macroend', preInitHook))

    // $LANGUAGE is useless as the source of truth: NSIS falls back to the first compiled
    // language for anything it does not ship, so "unknown" would look like Chinese.
    expect(preInitBody).not.toContain('$LANGUAGE ==')
    expect(preInitBody).toContain("System::Call 'kernel32::GetUserDefaultUILanguage() i .r0'")

    // Known UI language -> select it explicitly (no dialog); unknown -> the selector.
    for (const lcid of EIGHT_LANG_LCIDS) {
      expect(preInitBody).toContain(`$R0 == ${lcid}`)
      expect(preInitBody).toContain(`StrCpy $LANGUAGE ${lcid}`)
    }
    const selectorAt = preInitBody.indexOf('!insertmacro MUI_LANGDLL_DISPLAY')
    expect(selectorAt).toBeGreaterThan(0)
    // The selector sits in the fallback branch, after all 8 known-language branches.
    expect(selectorAt).toBeGreaterThan(preInitBody.lastIndexOf('${elseIf}'))
    // ... and it is skipped in the elevated inner instance, so one run never asks twice.
    expect(preInitBody).toContain('${ifNot} ${UAC_IsInnerInstance}')

    // The stub build must stay dialog-free; the gate is install-side only.
    const guard = script.indexOf('!ifndef BUILD_UNINSTALLER')
    expect(guard).toBeGreaterThan(0)
    expect(preInitHook).toBeGreaterThan(guard)
  })
})
