; DSH 安装器钩子：语言选择、安装目录继承、安装/卸载前关闭正在运行的程序。
;
; 为什么需要这份文件：electron-builder 会把 --include 指定的文件插进生成的 NSIS
; 脚本头部，并用这里定义的宏替换掉它自己的默认行为：
;   customHeader            —— 在 addLangs 之后插入（语言已装载，可以定义 LangString）
;   preInit                 —— 安装器 .onInit 开头（早于任何页面）
;   customCheckAppRunning   —— 安装段开始，取代默认 _CHECK_APP_RUNNING
;   customInit              —— .onInit 末尾、initMultiUser 之后
;   customUnInit            —— 卸载器 .onInit 末尾、initMultiUser 之后
;
; 历史根因（2026-11-06 实测）：上一版用
;   Get-CimInstance Win32_Process | ? { $_.Path -and (文件名 -ieq '...') }
; 探测进程。读取 Win32_Process.Path 需要权限，而普通用户权限下该 CIM 查询直接抛
; “拒绝访问 (0x80041003)”，PowerShell 退出码非 0。宏把非 0 读成“没有进程在运行”，
; 于是跳过关闭、继续复制文件；被映射的 app.asar / 可执行文件无法覆盖，安装却在没有
; 任何可见错误的情况下结束。nsProcess 走 Toolhelp32 快照按进程名枚举，不需要提升，
; 因此这里不读取任何进程路径。
;
; 编译顺序约束（2026-11-06 打包实测）：本文件被插入生成脚本的头部，而
; APP_EXECUTABLE_FILENAME / INSTALL_REGISTRY_KEY 要等 common.nsh、multiUser.nsh
; 才定义。因此顶层与 Function 体里不能引用这些宏，只能由宏插入点（展开在它们之后）
; 写进全局变量，函数只读变量。
;
; 两趟编译：electron-builder 先用 BUILD_UNINSTALLER 编出卸载器，再编安装器。
; 卸载器那一趟没有安装段调用点，安装器那一趟没有 un.* 调用点，所以相关函数分别
; 用 !ifdef 圈起来，避免声明了却未使用（warning 6001 会被 -WX 升级成构建失败）。

!ifndef DSH_INSTALLER_HOOKS_INCLUDED
!define DSH_INSTALLER_HOOKS_INCLUDED

!include LogicLib.nsh

; 提升安装的判断依赖 UAC.nsh；正常流程里 multiUser.nsh 已经包含过它，这里显式兜底。
!ifndef UAC_IsInnerInstance
  !include "UAC.nsh"
!endif

!ifndef nsProcess::FindProcess
  !include "nsProcess.nsh"
!endif

; 调用方（宏插入点）写入的目标进程名。函数体只读它。
; 两趟编译都有引用：安装器是 customCheckAppRunning / customInit，卸载器是 customUnInit。
Var /GLOBAL dshTargetExe

; 与 package.json 的 nsis.installerLanguages 一一对应。改动语言列表时必须同步本段：
; LangString 只能为已装载的语言定义，装不上的语言会让编译直接失败。
!define DSH_LANG_EN_US 1033
!define DSH_LANG_ZH_CN 2052
!define DSH_LANG_JA_JP 1041
!define DSH_LANG_ES_ES 3082
!define DSH_LANG_FR_FR 1036
!define DSH_LANG_DE_DE 1031
!define DSH_LANG_RU_RU 1049
!define DSH_LANG_PT_BR 1046

; 2.2.13 及更早由 Inno Setup 出货，卸载项写在这个键下（AppId 去掉一层转义后的实际值）。
; 升级时用它找回旧安装目录，避免把程序装到第二个位置。
!define DSH_INNO_UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\{B3E7C1D9-4A26-4F58-8C31-6D9E5A2B7C44}_is1"

; 输出 0 = 正在运行；1 = 未在运行（探测无法给出结论时同样按 1，随后由强制分支兜底，
; 避免再次“静默跳过”）。
!macro dsh_AppProcessRunning _FILE _RETURN
  nsProcess::_FindProcess /NOUNLOAD "${_FILE}"
  Pop $0
  ${if} $0 == 0
    StrCpy ${_RETURN} 0
  ${else}
    StrCpy ${_RETURN} 1
  ${endIf}
!macroend

; 关闭顺序：先请求旧实例经单实例通道自行退出（不等待，避免旧版本忽略参数时挂死），
; 最多等 30 秒；仍未退出则强制结束同名进程，再等 10 秒；仍然失败就明确报错。
!ifndef BUILD_UNINSTALLER
Function dsh_CloseRunningApp
  Push $0
  Push $R0
  Push $R1

  !insertmacro dsh_AppProcessRunning "$dshTargetExe" $R0
  ${if} $R0 != 0
    Goto dsh_close_done
  ${endIf}

  IfFileExists "$INSTDIR\$dshTargetExe" 0 dsh_close_force

  DetailPrint "$(appClosing)"
  ; 用 Exec 而不是 ExecWait：旧版本若忽略该参数会启动一个新窗口，ExecWait 会永远等下去。
  Exec '"$INSTDIR\$dshTargetExe" --dsh-installer-quit'

  StrCpy $R1 0
  dsh_close_wait_graceful:
    !insertmacro dsh_AppProcessRunning "$dshTargetExe" $R0
    ${if} $R0 != 0
      Goto dsh_close_done
    ${endIf}
    IntOp $R1 $R1 + 1
    ${if} $R1 < 60
      Sleep 500
      Goto dsh_close_wait_graceful
    ${endIf}

  dsh_close_force:
    DetailPrint "$(appClosing)"
    nsProcess::_KillProcess /NOUNLOAD "$dshTargetExe"
    Pop $0
    StrCpy $R1 0
  dsh_close_wait_kill:
    !insertmacro dsh_AppProcessRunning "$dshTargetExe" $R0
    ${if} $R0 != 0
      Goto dsh_close_done
    ${endIf}
    IntOp $R1 $R1 + 1
    ${if} $R1 > 20
      ; 这里必须让用户看见：静默继续安装会留下“装完了但没升级”的假象。
      MessageBox MB_OK|MB_ICONSTOP "$(CannotCloseAppInstall)$\r$\n$\r$\n$(CannotCloseAppInstallHint)"
      Quit
    ${endIf}
    Sleep 500
    Goto dsh_close_wait_kill

  dsh_close_done:
  nsProcess::_Unload
  Pop $R1
  Pop $R0
  Pop $0
FunctionEnd

; $R1 = 候选目录；有效（目录里确实有主程序）时才改写 $INSTDIR，并置 $R2 = 1。
Function dsh_AdoptInstallDir
  ${If} $R1 != ""
  ${AndIf} ${FileExists} "$R1\$dshTargetExe"
    StrCpy $INSTDIR $R1
    StrCpy $R2 1
  ${EndIf}
FunctionEnd
!endif

; 卸载器同样要先把程序关掉，否则被占用的文件会在 $INSTDIR 里留下残骸。
; 与安装不同：卸载不因为“关不掉”而中止——Inno 路线也是只提示、继续卸载。
!ifdef BUILD_UNINSTALLER
Function un.dsh_CloseRunningApp
  Push $0
  Push $R0
  Push $R1

  !insertmacro dsh_AppProcessRunning "$dshTargetExe" $R0
  ${if} $R0 != 0
    Goto un_dsh_close_done
  ${endIf}

  IfFileExists "$INSTDIR\$dshTargetExe" 0 un_dsh_close_force

  DetailPrint "$(appClosing)"
  Exec '"$INSTDIR\$dshTargetExe" --dsh-installer-quit'

  StrCpy $R1 0
  un_dsh_close_wait_graceful:
    !insertmacro dsh_AppProcessRunning "$dshTargetExe" $R0
    ${if} $R0 != 0
      Goto un_dsh_close_done
    ${endIf}
    IntOp $R1 $R1 + 1
    ${if} $R1 < 60
      Sleep 500
      Goto un_dsh_close_wait_graceful
    ${endIf}

  un_dsh_close_force:
    DetailPrint "$(appClosing)"
    nsProcess::_KillProcess /NOUNLOAD "$dshTargetExe"
    Pop $0
    StrCpy $R1 0
  un_dsh_close_wait_kill:
    !insertmacro dsh_AppProcessRunning "$dshTargetExe" $R0
    ${if} $R0 != 0
      Goto un_dsh_close_done
    ${endIf}
    IntOp $R1 $R1 + 1
    ${if} $R1 > 20
      ${IfNot} ${Silent}
        MessageBox MB_OK|MB_ICONEXCLAMATION "$(CannotCloseAppUninstall)$\r$\n$\r$\n$(CannotCloseAppUninstallHint)"
      ${EndIf}
      Goto un_dsh_close_done
    ${endIf}
    Sleep 500
    Goto un_dsh_close_wait_kill

  un_dsh_close_done:
  nsProcess::_Unload
  Pop $R1
  Pop $R0
  Pop $0
FunctionEnd
!endif

; 系统显示语言 → 安装器语言。$2 为空表示这 8 种语言里没有对应项，需要让用户选。
; 以主语言 ID 匹配，使 es-MX / fr-CA / pt-PT 这类区域变体也落到已编译的语言上；
; 中文按完整 LCID 区分：只有简体（zh-CN / zh-SG）直接采用，繁体交给选择框。
; 注意：这 8 个语言 ID 必须与 installerLanguages 一致，否则 $LANGUAGE 会被 NSIS
; 回退到默认语言，等于“跟随系统”失效。
!macro dsh_DetectLanguage
  System::Call 'kernel32::GetUserDefaultUILanguage() i.r0'
  StrCpy $1 $0
  IntOp $0 $0 & 0x3FF
  StrCpy $2 ""
  ${If} $0 == 4
    ${If} $1 == 2052
    ${OrIf} $1 == 4100
      StrCpy $2 2052
    ${EndIf}
  ${ElseIf} $0 == 9
    StrCpy $2 1033
  ${ElseIf} $0 == 17
    StrCpy $2 1041
  ${ElseIf} $0 == 10
    StrCpy $2 3082
  ${ElseIf} $0 == 12
    StrCpy $2 1036
  ${ElseIf} $0 == 7
    StrCpy $2 1031
  ${ElseIf} $0 == 25
    StrCpy $2 1049
  ${ElseIf} $0 == 22
    StrCpy $2 1046
  ${EndIf}

  ${If} $2 != ""
    StrCpy $LANGUAGE $2
  ${Else}
    ; 判定不出来才弹选择框。宏内部对静默安装有保护，/S 时不会出窗口。
    !insertmacro MUI_LANGDLL_DISPLAY
  ${EndIf}
!macroend

; 语言选择的两个函数定义在下面的 customHeader 里，不在这里：本文件被插在 MUI2.nsh
; 之前，而 MUI_LANGDLL_DISPLAY 由 MUI2 的 Localization.nsh 提供；只有 customHeader
; 展开时（addLangs 之后）MUI 宏与 LangString 才都可用。

; 在 addLangs 之后插入：此时 8 种语言都已 LoadLanguageFile，可以定义 LangString。
; 键名沿用 Inno 路线的 4 个键；英语那条是兜底（任一语言缺翻译时 NSIS 回落到默认语言）。
!macro customHeader
  ; 我们自己在 preInit / customUnInit 里调 LangDLL::LangDialog，必须显式保留插件。
  !insertmacro MUI_RESERVEFILE_LANGDLL

  LangString CannotCloseAppInstall ${DSH_LANG_EN_US} "Cannot close the running Nonead DSH Desktop. The installation was cancelled."
  LangString CannotCloseAppInstallHint ${DSH_LANG_EN_US} "Quit it manually, then run this installer again."
  LangString CannotCloseAppUninstall ${DSH_LANG_EN_US} "Cannot close the running Nonead DSH Desktop."
  LangString CannotCloseAppUninstallHint ${DSH_LANG_EN_US} "Quit it manually and run the uninstaller again, so no in-use files are left behind."

  LangString CannotCloseAppInstall ${DSH_LANG_ZH_CN} "无法关闭正在运行的 Nonead DSH Desktop，安装已取消。"
  LangString CannotCloseAppInstallHint ${DSH_LANG_ZH_CN} "请手动退出该程序后重新运行安装包。"
  LangString CannotCloseAppUninstall ${DSH_LANG_ZH_CN} "无法关闭正在运行的 Nonead DSH Desktop。"
  LangString CannotCloseAppUninstallHint ${DSH_LANG_ZH_CN} "请手动退出该程序后再次卸载，以免残留被占用的文件。"

  LangString CannotCloseAppInstall ${DSH_LANG_JA_JP} "実行中の Nonead DSH Desktop を終了できませんでした。インストールを中止します。"
  LangString CannotCloseAppInstallHint ${DSH_LANG_JA_JP} "手動で終了してから、もう一度インストーラーを実行してください。"
  LangString CannotCloseAppUninstall ${DSH_LANG_JA_JP} "実行中の Nonead DSH Desktop を終了できませんでした。"
  LangString CannotCloseAppUninstallHint ${DSH_LANG_JA_JP} "手動で終了してから、もう一度アンインストーラーを実行してください。使用中のファイルが残らないようにします。"

  LangString CannotCloseAppInstall ${DSH_LANG_ES_ES} "No se pudo cerrar Nonead DSH Desktop en ejecución. La instalación se ha cancelado."
  LangString CannotCloseAppInstallHint ${DSH_LANG_ES_ES} "Ciérrelo manualmente y vuelva a ejecutar el instalador."
  LangString CannotCloseAppUninstall ${DSH_LANG_ES_ES} "No se pudo cerrar Nonead DSH Desktop en ejecución."
  LangString CannotCloseAppUninstallHint ${DSH_LANG_ES_ES} "Ciérrelo manualmente y vuelva a ejecutar el desinstalador para no dejar archivos en uso."

  LangString CannotCloseAppInstall ${DSH_LANG_FR_FR} "Impossible de fermer Nonead DSH Desktop en cours d'exécution. L'installation est annulée."
  LangString CannotCloseAppInstallHint ${DSH_LANG_FR_FR} "Quittez-le manuellement, puis relancez l'installeur."
  LangString CannotCloseAppUninstall ${DSH_LANG_FR_FR} "Impossible de fermer Nonead DSH Desktop en cours d'exécution."
  LangString CannotCloseAppUninstallHint ${DSH_LANG_FR_FR} "Quittez-le manuellement, puis relancez le désinstalleur pour ne laisser aucun fichier verrouillé."

  LangString CannotCloseAppInstall ${DSH_LANG_DE_DE} "Das laufende Nonead DSH Desktop konnte nicht beendet werden. Die Installation wurde abgebrochen."
  LangString CannotCloseAppInstallHint ${DSH_LANG_DE_DE} "Beenden Sie es manuell und starten Sie das Setup erneut."
  LangString CannotCloseAppUninstall ${DSH_LANG_DE_DE} "Das laufende Nonead DSH Desktop konnte nicht beendet werden."
  LangString CannotCloseAppUninstallHint ${DSH_LANG_DE_DE} "Beenden Sie es manuell und starten Sie die Deinstallation erneut, damit keine gesperrten Dateien zurückbleiben."

  LangString CannotCloseAppInstall ${DSH_LANG_RU_RU} "Не удалось закрыть запущенный Nonead DSH Desktop. Установка отменена."
  LangString CannotCloseAppInstallHint ${DSH_LANG_RU_RU} "Закройте его вручную и запустите установщик снова."
  LangString CannotCloseAppUninstall ${DSH_LANG_RU_RU} "Не удалось закрыть запущенный Nonead DSH Desktop."
  LangString CannotCloseAppUninstallHint ${DSH_LANG_RU_RU} "Закройте его вручную и запустите деинсталлятор снова, чтобы не остались занятые файлы."

  LangString CannotCloseAppInstall ${DSH_LANG_PT_BR} "Não foi possível fechar o Nonead DSH Desktop em execução. A instalação foi cancelada."
  LangString CannotCloseAppInstallHint ${DSH_LANG_PT_BR} "Feche-o manualmente e execute o instalador novamente."
  LangString CannotCloseAppUninstall ${DSH_LANG_PT_BR} "Não foi possível fechar o Nonead DSH Desktop em execução."
  LangString CannotCloseAppUninstallHint ${DSH_LANG_PT_BR} "Feche-o manualmente e execute o desinstalador novamente para não deixar arquivos em uso."

  ; 语言选择在这之后才定义：MUI_LANGDLL_DISPLAY 由 MUI2 的 Localization.nsh 提供，
  ; 而本文件插在 MUI2.nsh 之前；customHeader 展开时（addLangs 之后）它才可用。
  !ifndef BUILD_UNINSTALLER
  Function dsh_SelectLanguage
    !insertmacro dsh_DetectLanguage
  FunctionEnd
  !endif

  !ifdef BUILD_UNINSTALLER
  Function un.dsh_SelectLanguage
    !insertmacro dsh_DetectLanguage
  FunctionEnd
  !endif
!macroend

; 安装器 .onInit 开头：语言先定下来，后面的页面才按正确语言创建。
!macro preInit
  !ifndef BUILD_UNINSTALLER
    Call dsh_SelectLanguage
  !endif
!macroend

; electron-builder 的默认钩子：安装段开始时调用（common.nsh 之后，宏可用）。
!macro customCheckAppRunning
  !ifndef BUILD_UNINSTALLER
    StrCpy $dshTargetExe "${APP_EXECUTABLE_FILENAME}"
    Call dsh_CloseRunningApp
  !endif
!macroend

; .onInit 末尾（initMultiUser 之后）：
;   1) 提升安装会让安装器以 UAC 内层实例重跑，而 installSection.nsh 在内层实例会跳过
;      CHECK_APP_RUNNING，所以这里补一次关停（普通安装仍等到真正开始复制才动作，
;      取消安装不会白白关掉用户正在用的程序）；
;   2) 找回已安装目录：perMachine 只会读 HKLM 的 Software\<APP_GUID>，读不到 electron-builder
;      旧的 per-user 安装（HKCU）与 Inno 路线（另一套卸载键）的目录，这里补齐，
;      使升级/重装始终落在同一个位置；都没有时才回到默认的 Program Files。
!macro customInit
  !ifndef BUILD_UNINSTALLER
    StrCpy $dshTargetExe "${APP_EXECUTABLE_FILENAME}"

    ${if} ${UAC_IsInnerInstance}
      Call dsh_CloseRunningApp
    ${endIf}

    StrCpy $R2 0
    ; /D= 是用户显式指定的目录，优先级高于任何历史记录。
    !insertmacro GetDParameter $R0
    ${If} $R0 == ""
      ReadRegStr $R1 HKLM "${INSTALL_REGISTRY_KEY}" "InstallLocation"
      Call dsh_AdoptInstallDir

      ${If} $R2 == 0
        ReadRegStr $R1 HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation"
        Call dsh_AdoptInstallDir
      ${EndIf}

      ${If} $R2 == 0
        ReadRegStr $R1 HKLM "${DSH_INNO_UNINSTALL_KEY}" "InstallLocation"
        ${If} $R1 == ""
          ReadRegStr $R1 HKLM "${DSH_INNO_UNINSTALL_KEY}" "Inno Setup: App Path"
        ${EndIf}
        Call dsh_AdoptInstallDir
      ${EndIf}

      ${If} $R2 == 0
        ReadRegStr $R1 HKCU "${DSH_INNO_UNINSTALL_KEY}" "InstallLocation"
        ${If} $R1 == ""
          ReadRegStr $R1 HKCU "${DSH_INNO_UNINSTALL_KEY}" "Inno Setup: App Path"
        ${EndIf}
        Call dsh_AdoptInstallDir
      ${EndIf}

      ; 注册表指向的目录已经没有主程序（卸载残留 / 手工删除）：回到默认位置。
      ${If} $R2 == 0
      ${AndIfNot} ${FileExists} "$INSTDIR\$dshTargetExe"
        StrCpy $INSTDIR "$PROGRAMFILES64\${APP_FILENAME}"
      ${EndIf}
    ${EndIf}
    !endif
!macroend

; 卸载器 .onInit 末尾（initMultiUser 之后）：先定语言，再关程序，之后才进卸载段。
!macro customUnInit
  StrCpy $dshTargetExe "${APP_EXECUTABLE_FILENAME}"
  Call un.dsh_SelectLanguage
  Call un.dsh_CloseRunningApp
!macroend

!endif
