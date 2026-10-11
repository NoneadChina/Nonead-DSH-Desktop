; Check the exact app process before launching the quit handoff. This preserves
; the #469 fix: unrelated helpers under $INSTDIR must never block an upgrade.
Var pid

!macro customCheckAppRunning
  !insertmacro IS_POWERSHELL_AVAILABLE
  !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
  ${if} $R0 != 0
    Goto dsh_installer_app_stopped
  ${endIf}

  IfFileExists "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 dsh_installer_scoped_fallback
    ; Newer versions receive this through Electron's single-instance channel.
    ; 2.0.2 ignores it, so the scoped builder fallback remains necessary for
    ; the first upgrade to a version that supports orderly shutdown.
    ExecWait '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --dsh-installer-quit'
    StrCpy $R1 0

  dsh_installer_wait_for_exit:
    !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
    ${if} $R0 != 0
      Goto dsh_installer_app_stopped
    ${endIf}
    IntOp $R1 $R1 + 1
    ; Slow disks, antivirus hooks, and a large physical runtime can keep the
    ; process alive after Cordis disposal begins. Give the orderly handoff a
    ; full 30 seconds before escalating to the scoped forced-close path.
    ${if} $R1 < 60
      Sleep 500
      Goto dsh_installer_wait_for_exit
    ${endIf}

  dsh_installer_scoped_fallback:
    ; The patched builder macros match Nonead DSH Desktop Beta.exe, not every executable
    ; below $INSTDIR. They handle pre-handoff releases and stubborn processes.
    MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "$(appRunning)" /SD IDOK IDOK dsh_installer_stop_app
    Quit

  dsh_installer_stop_app:
    DetailPrint "$(appClosing)"
    ; KILL_PROCESS's tasklist fallback excludes $pid. The installer never has
    ; the application executable name, so zero is a safe sentinel here.
    StrCpy $pid 0
    !insertmacro KILL_PROCESS "${APP_EXECUTABLE_FILENAME}" 0
    Sleep 500
    StrCpy $R1 0

  dsh_installer_wait_for_fallback:
    !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
    ${if} $R0 != 0
      Goto dsh_installer_app_stopped
    ${endIf}
    IntOp $R1 $R1 + 1
    ${if} $R1 > 1
      MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDCANCEL IDRETRY dsh_installer_wait_for_fallback
      Quit
    ${endIf}
    Sleep 1000
    !insertmacro KILL_PROCESS "${APP_EXECUTABLE_FILENAME}" 1
    Sleep 500
    Goto dsh_installer_wait_for_fallback

  dsh_installer_app_stopped:
!macroend

; The DSH-era installer shipped this edition as "DSH Desktop Beta" and left a
; shortcut under that name. It still carries this edition's AppUserModelID, but
; its target is the install directory the rename abandoned. Windows resolves a
; window's taskbar button icon through the shortcut matching its
; AppUserModelID, so the dangling leftover makes the running application show a
; blank taskbar icon. The builder's own rename migration only rewrites shortcuts
; recorded under this appId's install registry key, so an orphaned shortcut has
; to go here.
!macro customInstall
  ; Every place the shell can resolve this appId from has to be covered, not just
  ; the two the rename was noticed in. A taskbar-pinned shortcut is the worst of
  ; them: the pin stores the icon the window had when it was pinned, so a leftover
  ; pin keeps showing the pre-rename blank button however correct the window icon
  ; is today, and neither reinstalling nor upgrading ever rewrites it.
  Delete "$SMPROGRAMS\DSH Desktop Beta.lnk"
  ; NSIS has no $COMMONPROGRAMS: the machine-wide start menu is this same
  ; $SMPROGRAMS variable read under the "all" shell variable context. Restore the
  ; installer's own mode right after, so nothing downstream sees our switch.
  SetShellVarContext all
  Delete "$SMPROGRAMS\DSH Desktop Beta.lnk"
  ${if} $installMode == "all"
    SetShellVarContext all
  ${else}
    SetShellVarContext current
  ${endif}
  Delete "$DESKTOP\DSH Desktop Beta.lnk"
  Delete "$APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar\DSH Desktop Beta.lnk"
  ; addDesktopLink raises this only when it actually creates a desktop shortcut,
  ; which the assisted installer lets the user decline. Raise it unconditionally
  ; so the shell rebuilds its icon cache on every install.
  System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
!macroend
