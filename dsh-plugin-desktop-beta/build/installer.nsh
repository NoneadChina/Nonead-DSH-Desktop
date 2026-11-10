; Compile-time marker: the packaging log must show this line, otherwise the include was
; silently skipped and the running-app handoff below is not in the installer at all.
!echo "DSH installer include: running-app handoff compiled"

; Running-app handoff for both directions of the lifecycle.
;
; Install: the hook lives in customInit. electron-builder builds the generated script as
; `!include <this file>` followed by templates/nsis/installer.nsi, so the macro is already
; defined when installer.nsi:80 runs `!ifmacrodef customInit` inside .onInit. That is before
; any page is shown and before uninstallOldVersion copies over the installation, which is
; exactly where a live instance must be gone.
;
; Uninstall: the hook lives in customUnInstall, which uninstaller.nsh:156 inserts inside the
; uninstall section right before the files are deleted. A live instance must be gone there
; too, otherwise Windows keeps the executable and the directory cannot be removed.
;
; customCheckAppRunning is kept defined but empty so the stock implementation - which offers
; a cancel-to-skip prompt and then Quits - is never compiled in. On install a live instance
; is never skippable; on uninstall the explicit confirmation in customUnInstall governs.
; The wait counter uses $R1 instead of a declared Var: the throwaway uninstaller stub compiles
; the !ifdef BUILD_UNINSTALLER branch without executing it, so a declared variable would be
; "never set" there and NSIS warning 6001 is fatal under warningsAsErrors.

; Exact-image match by file name, independent of the install directory, so a previous
; version installed elsewhere is found too. Contract: the return value is 0 when the
; application runs, non-zero otherwise.
!macro dshInstallerFindApp _RETURN
  nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -Command "if ((Get-Process | Where-Object { $$_.Path -and [System.IO.Path]::GetFileName($$_.Path) -ieq '${APP_EXECUTABLE_FILENAME}' }).Count -gt 0) { exit 0 } else { exit 1 }"`
  Pop ${_RETURN}
  ${if} ${_RETURN} != 0
    ; PowerShell can be missing or blocked by execution policy, and Get-Process cannot read the
    ; path of a process owned by another user. tasklist sees every session and matches on the
    ; image name alone, so it is the fallback that decides when PowerShell says "not running".
    nsExec::Exec `cmd /C tasklist /FI "IMAGENAME eq ${APP_EXECUTABLE_FILENAME}" /FO CSV /NH | findstr /I /C:"${APP_EXECUTABLE_FILENAME}"`
    Pop ${_RETURN}
    ${if} ${_RETURN} == 0
      StrCpy ${_RETURN} 0
    ${else}
      StrCpy ${_RETURN} 1
    ${endIf}
  ${endIf}
!macroend

!macro dshInstallerKillApp _FORCE
  ${if} ${_FORCE} == 1
    nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -Command "Get-Process | Where-Object { $$_.Path -and [System.IO.Path]::GetFileName($$_.Path) -ieq '${APP_EXECUTABLE_FILENAME}' } | Stop-Process -Force"`
  ${else}
    ; Stop-Process without -Force still terminates the process tree gracefully enough for
    ; Electron, which has no window message loop to close from here.
    nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -Command "Get-Process | Where-Object { $$_.Path -and [System.IO.Path]::GetFileName($$_.Path) -ieq '${APP_EXECUTABLE_FILENAME}' } | Stop-Process"`
  ${endIf}
  Pop $0
  ; Fallback for hosts where PowerShell is blocked by policy.
  nsExec::Exec `taskkill /IM "${APP_EXECUTABLE_FILENAME}" /F /FI "USERNAME eq %USERNAME%"`
  Pop $0
!macroend

; Assumes the instance is running. Asks it to quit, waits, then escalates to forced kills, and
; aborts with a non-zero exit code when it still refuses to die.
!macro dshInstallerCloseRunningApp
  DetailPrint "$(appClosing)"
  IfFileExists "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 dsh_installer_close_force
    ; Newer versions receive this through Electron's single-instance channel and dispose
    ; their Profiles and sessions cleanly. 2.0.2 ignores the flag, so the forced path below
    ; is still required for the first upgrade to a version that understands it.
    ExecWait '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --dsh-installer-quit'
    StrCpy $R1 0
  dsh_installer_close_wait:
    !insertmacro dshInstallerFindApp $R0
    ${if} $R0 == 0
      IntOp $R1 $R1 + 1
      ${if} $R1 < 20
        Sleep 500
        Goto dsh_installer_close_wait
      ${endIf}
    ${endIf}

  dsh_installer_close_force:
    StrCpy $R1 0
  dsh_installer_close_force_loop:
    !insertmacro dshInstallerKillApp 0
    Sleep 800
    !insertmacro dshInstallerFindApp $R0
    ${if} $R0 == 0
      !insertmacro dshInstallerKillApp 1
      Sleep 800
      !insertmacro dshInstallerFindApp $R0
    ${endIf}
    ${if} $R0 != 0
      Goto dsh_installer_close_done
    ${endIf}
    IntOp $R1 $R1 + 1
    ${if} $R1 < 6
      Goto dsh_installer_close_force_loop
    ${endIf}

    ; Six orderly and forced attempts over ~10 s. Stop with a non-zero exit code instead of
    ; overwriting files that are still open: a half-copied installation is worse than none.
    MessageBox MB_ICONSTOP "$(appCannotBeClosed)"
    SetErrorLevel 2
    Quit

  dsh_installer_close_done:
!macroend

; Install path: close a running previous version before the installer touches $INSTDIR.
; The throwaway uninstaller stub (BUILD_UNINSTALLER) is compiled and executed on the release
; machine, where this very application is normally running. It must not run these checks or
; the build aborts with exit code 2 instead of producing an installer.
!ifndef BUILD_UNINSTALLER
!macro customInit
  !insertmacro dshInstallerFindApp $R0
  ${if} $R0 == 0
    !insertmacro dshInstallerCloseRunningApp
  ${endIf}
!macroend
!endif

; Uninstall path: confirm with the operator, then close and delete everything.
;
; The prompt is the one requirement that must not be silent: uninstalling something that is
; currently open is destructive, so Cancel has to leave both the installation and the running
; instance untouched. When nothing is running this macro does nothing and the uninstaller
; proceeds immediately with no prompt. /SD IDOK keeps a silent (/S) uninstall from hanging.
!ifdef BUILD_UNINSTALLER
!macro customUnInstall
  !insertmacro dshInstallerFindApp $R0
  ${if} $R0 == 0
    MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "你的程序还在运行中，点击$\"确定$\"会主动被关闭，随后继续卸载；点击$\"取消$\"则放弃卸载。$\r$\n$\r$\n${PRODUCT_NAME} is still running: OK closes it and continues, Cancel aborts the uninstall." /SD IDOK IDOK dsh_uninstall_close_app
    ; Cancel: stop here, leave the installation and the running instance alone.
    Quit

    dsh_uninstall_close_app:
    !insertmacro dshInstallerCloseRunningApp
  ${endIf}
!macroend
!endif

!macro customCheckAppRunning
  ; Handled in customInit (install) and customUnInstall (uninstall); never offer to skip a
  ; running instance.
!macroend
