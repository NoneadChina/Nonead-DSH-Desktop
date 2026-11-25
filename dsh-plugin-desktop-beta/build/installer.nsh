; Compile-time marker: the packaging log must show this line, otherwise the include was
; silently skipped and the running-app handoff below is not in the installer at all.
!echo "DSH installer include: running-app handoff compiled"

; ---------------------------------------------------------------------------
; Localized strings for the two "cannot close the running app" situations.
;
; The 4 keys below carry the same texts, and the same split (title + hint), as the Inno
; line (nonead-dsh-desktop/scripts/inno/desktop.iss [CustomMessages]); the MessageBox joins
; them with one line break exactly like Inno's `#13#10`. NSIS LangString enumerates LCIDs
; explicitly, so English (1033) is both one of the 8 entries and the fallback for any other
; system locale.
;
; Keep the LangString definitions above all macros: the generated script includes this file
; in the header, before templates/nsis/installer.nsi expands MUI_LANGUAGE. electron-builder
; reads messages.yml into LangString lines in exactly the same position.
; ---------------------------------------------------------------------------
LangString dshCannotCloseAppInstall        1033 "Cannot close the running ${PRODUCT_NAME}."
LangString dshCannotCloseAppInstallHint    1033 "Quit it manually, then run this installer again."
LangString dshCannotCloseAppUninstall      1033 "Cannot close the running ${PRODUCT_NAME}."
LangString dshCannotCloseAppUninstallHint  1033 "Quit it manually and run the uninstaller again, so no in-use files are left behind."

LangString dshCannotCloseAppInstall        2052 "无法关闭正在运行的 ${PRODUCT_NAME}，安装已取消。"
LangString dshCannotCloseAppInstallHint    2052 "请手动退出该程序后重新运行安装包。"
LangString dshCannotCloseAppUninstall      2052 "无法关闭正在运行的 ${PRODUCT_NAME}。"
LangString dshCannotCloseAppUninstallHint  2052 "请手动退出该程序后再次卸载，以免残留被占用的文件。"

LangString dshCannotCloseAppInstall        1041 "実行中の ${PRODUCT_NAME} を終了できませんでした。インストールを中止します。"
LangString dshCannotCloseAppInstallHint    1041 "手動で終了してから、もう一度インストーラーを実行してください。"
LangString dshCannotCloseAppUninstall      1041 "実行中の ${PRODUCT_NAME} を終了できませんでした。"
LangString dshCannotCloseAppUninstallHint  1041 "手動で終了してから、もう一度アンインストーラーを実行してください。使用中のファイルが残らないようにします。"

LangString dshCannotCloseAppInstall        3082 "No se pudo cerrar ${PRODUCT_NAME} en ejecución. La instalación se ha cancelado."
LangString dshCannotCloseAppInstallHint    3082 "Ciérrelo manualmente y vuelva a ejecutar el instalador."
LangString dshCannotCloseAppUninstall      3082 "No se pudo cerrar ${PRODUCT_NAME} en ejecución."
LangString dshCannotCloseAppUninstallHint  3082 "Ciérrelo manualmente y vuelva a ejecutar el desinstalador para no dejar archivos en uso."

LangString dshCannotCloseAppInstall        1036 "Impossible de fermer ${PRODUCT_NAME} en cours d'exécution. L'installation est annulée."
LangString dshCannotCloseAppInstallHint    1036 "Quittez-le manuellement, puis relancez l'installeur."
LangString dshCannotCloseAppUninstall      1036 "Impossible de fermer ${PRODUCT_NAME} en cours d'exécution."
LangString dshCannotCloseAppUninstallHint  1036 "Quittez-le manuellement, puis relancez le désinstalleur pour ne laisser aucun fichier verrouillé."

LangString dshCannotCloseAppInstall        1031 "Das laufende ${PRODUCT_NAME} konnte nicht beendet werden. Die Installation wurde abgebrochen."
LangString dshCannotCloseAppInstallHint    1031 "Beenden Sie es manuell und starten Sie das Setup erneut."
LangString dshCannotCloseAppUninstall      1031 "Das laufende ${PRODUCT_NAME} konnte nicht beendet werden."
LangString dshCannotCloseAppUninstallHint  1031 "Beenden Sie es manuell und starten Sie die Deinstallation erneut, damit keine gesperrten Dateien zurückbleiben."

LangString dshCannotCloseAppInstall        1049 "Не удалось закрыть запущенный ${PRODUCT_NAME}. Установка отменена."
LangString dshCannotCloseAppInstallHint    1049 "Закройте его вручную и запустите установщик снова."
LangString dshCannotCloseAppUninstall      1049 "Не удалось закрыть запущенный ${PRODUCT_NAME}."
LangString dshCannotCloseAppUninstallHint  1049 "Закройте его вручную и запустите деинсталлятор снова, чтобы не остались занятые файлы."

LangString dshCannotCloseAppInstall        1046 "Não foi possível fechar o ${PRODUCT_NAME} em execução. A instalação foi cancelada."
LangString dshCannotCloseAppInstallHint    1046 "Feche-o manualmente e execute o instalador novamente."
LangString dshCannotCloseAppUninstall      1046 "Não foi possível fechar o ${PRODUCT_NAME} em execução."
LangString dshCannotCloseAppUninstallHint  1046 "Feche-o manualmente e execute o desinstalador novamente para não deixar arquivos em uso."

; ---------------------------------------------------------------------------
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
; is never skippable; on uninstall the close is attempted directly, mirroring the Inno line.
; The wait counter uses $R1 instead of a declared Var: the throwaway uninstaller stub compiles
; the !ifdef BUILD_UNINSTALLER branch without executing it, so a declared variable would be
; "never set" there and NSIS warning 6001 is fatal under warningsAsErrors.
;
; dshInstallerCloseRunningApp takes the title and hint LangString ids as macro arguments, so
; the install and uninstall paths can point at their own two strings without duplicating the
; loop - the same split the Inno line uses (CannotCloseApp* + CannotCloseApp*Hint).
; ---------------------------------------------------------------------------

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
; aborts with a non-zero exit code when it still refuses to die. ${_FAILTITLE} and
; ${_FAILHINT} must be LangString ids; they are joined with one line break and shown as a
; plain error notice (MB_OK), the same shape as the Inno line. /SD IDOK keeps a silent (/S)
; install or uninstall from hanging on that notice - it still exits with code 2.
!macro dshInstallerCloseRunningApp _FAILTITLE _FAILHINT
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
    MessageBox MB_ICONSTOP `$(${_FAILTITLE})$\r$\n$(${_FAILHINT})` /SD IDOK
    SetErrorLevel 2
    Quit

  dsh_installer_close_done:
!macroend

; ---------------------------------------------------------------------------
; Language selection (requirement: follow the Windows display language, and only ask when
; it cannot be resolved to one of the 8 bundled languages).
;
; $LANGUAGE must not be trusted here. NSIS only knows the language files compiled into the
; installer, and when the system language is not among them it silently falls back to the
; first compiled one - so a system in a language we do not ship looks exactly like that
; first language and the selector would never appear. GetUserDefaultUILanguage asks Windows
; for the real per-user UI language instead (1033 en-US, 2052 zh-CN, 1041 ja-JP, 3082 es-ES,
; 1036 fr-FR, 1031 de-DE, 1049 ru-RU, 1046 pt-BR - the LCIDs electron-builder maps the 8
; `installerLanguages` entries to, es_ES being SpanishInternational and pt_BR PortugueseBR).
;
; The hook is named preInit because that is the name templates/nsis/installer.nsi:56 inserts
; inside .onInit, ahead of its own DISPLAY_LANG_SELECTOR branch at :60. It runs after
; `!insertmacro addLangs` (:44), so MUI_LANGDLL_LANGUAGES is already defined and the selector
; lists exactly the 8 languages. displayLanguageSelector is deliberately NOT enabled: that
; would prompt on every single run. The uninstaller stub (BUILD_UNINSTALLER) skips all of
; this, silent installs are skipped inside MUI_LANGDLL_DISPLAY, and the elevated inner
; instance is skipped so one run never asks twice.
; ---------------------------------------------------------------------------
!ifndef BUILD_UNINSTALLER
!macro preInit
  System::Call 'kernel32::GetUserDefaultUILanguage() i .r0'

  ; Known UI language: select it explicitly, so NSIS's fallback to the first compiled
  ; language can never win. Unknown: offer the selector once so the operator can pick.
  ${if} $R0 == 2052
    StrCpy $LANGUAGE 2052
  ${elseIf} $R0 == 1033
    StrCpy $LANGUAGE 1033
  ${elseIf} $R0 == 1041
    StrCpy $LANGUAGE 1041
  ${elseIf} $R0 == 3082
    StrCpy $LANGUAGE 3082
  ${elseIf} $R0 == 1036
    StrCpy $LANGUAGE 1036
  ${elseIf} $R0 == 1031
    StrCpy $LANGUAGE 1031
  ${elseIf} $R0 == 1049
    StrCpy $LANGUAGE 1049
  ${elseIf} $R0 == 1046
    StrCpy $LANGUAGE 1046
  ${else}
    ${ifNot} ${UAC_IsInnerInstance}
      !insertmacro MUI_LANGDLL_DISPLAY
    ${endIf}
  ${endIf}
!macroend
!endif

; ---------------------------------------------------------------------------
; Fresh-install onboarding handoff.
;
; electron-builder's stock finish page starts the app through its own StartApp function:
; `--updated` for an upgrade, no argument for a first install. A first install must land in
; the setup wizard instead of a normal window whose Profile already carries a completion
; record from an earlier copy on this machine - that is why this file overrides the whole
; finish page rather than only the run command.
;
; Overriding customFinishPage replaces assistedInstaller.nsh's default branch, so the same
; MUI_FINISHPAGE_RUN wiring and StartApp body are reproduced here with one extra case.
; $dshFreshInstall is decided in customInit, before any page is shown and before
; uninstallOldVersion touches $INSTDIR.
; ---------------------------------------------------------------------------
!ifndef BUILD_UNINSTALLER
Var dshFreshInstall

!macro customFinishPage
  Function StartApp
    ${if} $dshFreshInstall == 1
      ; src/relaunch.ts::ONBOARDING_ARGUMENT - main.ts forces the wizard for this run.
      StrCpy $1 "--next-onboarding"
    ${elseif} ${isUpdated}
      StrCpy $1 "--updated"
    ${else}
      StrCpy $1 ""
    ${endif}
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
  FunctionEnd

  !define MUI_FINISHPAGE_RUN
  !define MUI_FINISHPAGE_RUN_FUNCTION "StartApp"
  !insertmacro MUI_PAGE_FINISH
!macroend
!endif

; Install path: close a running previous version before the installer touches $INSTDIR.
; The throwaway uninstaller stub (BUILD_UNINSTALLER) is compiled and executed on the release
; machine, where this very application is normally running. It must not run these checks or
; the build aborts with exit code 2 instead of producing an installer.
!ifndef BUILD_UNINSTALLER
!macro customInit
  ; This product line shipped an Inno Setup installer before this one. Its uninstall entry is the
  ; only record of where that copy lives, so adopt it while no NSIS installation exists yet: an
  ; upgrade then lands on top of the existing folder instead of a second copy in Program Files.
  !if "${PRODUCT_NAME}" == "Nonead DSH Desktop"
  ${if} $installMode == all
    ReadRegStr $R4 HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation
    ${if} $R4 == ""
      ReadRegStr $R3 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\{B3E7C1D9-4A26-4F58-8C31-6D9E5A2B7C44}_is1" "InstallLocation"
      ${if} $R3 != ""
        IfFileExists "$R3\${APP_EXECUTABLE_FILENAME}" 0 +2
          StrCpy $INSTDIR $R3
      ${endIf}
    ${endIf}
  ${endIf}
  !endif

  ; Decide the onboarding handoff while $INSTDIR is final (multiUser.nsh already read the
  ; registry and the Inno handoff above may have moved it) but before uninstallOldVersion
  ; removes the previous copy: an executable already in place means this is an upgrade.
  IfFileExists "$INSTDIR\${APP_EXECUTABLE_FILENAME}" dsh_installer_existing dsh_installer_fresh
  dsh_installer_fresh:
    StrCpy $dshFreshInstall 1
    Goto dsh_installer_fresh_done
  dsh_installer_existing:
    StrCpy $dshFreshInstall 0
  dsh_installer_fresh_done:

  ; A fresh machine-wide install always lands in the documented location. An existing
  ; installation wins instead: multiUser.nsh already adopted its InstallLocation above, and
  ; this branch stays out of the way so upgrades keep the folder the user picked earlier.
  !if "${PRODUCT_NAME}" == "Nonead DSH Desktop"
  ${if} $dshFreshInstall == 1
  ${AndIf} $installMode == all
    StrCpy $INSTDIR "$PROGRAMFILES64\${PRODUCT_NAME}"
  ${endIf}
  !endif

  !insertmacro dshInstallerFindApp $R0
  ${if} $R0 == 0
    !insertmacro dshInstallerCloseRunningApp `dshCannotCloseAppInstall` `dshCannotCloseAppInstallHint`
  ${endIf}
!macroend
!endif

; Uninstall path: close the running instance, then delete everything. Mirrors the Inno line:
; the close is attempted directly; only when the app refuses to die does the operator get a
; localized notice telling them to quit it manually and uninstall again.
!ifdef BUILD_UNINSTALLER
!macro customUnInstall
  ; The release build executes this uninstaller payload once - as the freshly built Setup.exe -
  ; to write Uninstall.exe, and the release machine usually has some copy of this application
  ; running. Only a real uninstallation runs from an Uninstall*.exe, so identify that first:
  ; closing a running instance is required there, and attempting it during the build would abort
  ; the release with exit code 2 whenever any copy of the application happens to be open.
  StrCpy $R0 $EXEFILE 9
  StrCmp $R0 "Uninstall" 0 dsh_installer_uninstall_close_done
  ; A real uninstallation of an installed copy has the executable under $INSTDIR.
  StrCmp $INSTDIR "" dsh_installer_uninstall_close_done
  IfFileExists "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 dsh_installer_uninstall_close_done
  !insertmacro dshInstallerFindApp $R0
  ${if} $R0 == 0
    !insertmacro dshInstallerCloseRunningApp `dshCannotCloseAppUninstall` `dshCannotCloseAppUninstallHint`
  ${endif}
  dsh_installer_uninstall_close_done:
!macroend
!endif

!macro customCheckAppRunning
  ; Handled in customInit (install) and customUnInstall (uninstall); never offer to skip a
  ; running instance.
!macroend
