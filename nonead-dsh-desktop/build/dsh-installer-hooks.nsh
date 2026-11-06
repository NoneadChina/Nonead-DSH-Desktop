; DSH 安装器钩子：复制新文件前关闭正在运行的旧版本。
;
; 为什么需要这份文件：electron-builder 会把它包含进生成的安装器脚本头部，
; 并用这里的 customCheckAppRunning 取代默认的 _CHECK_APP_RUNNING。
;
; 历史根因（2026-11-06 实测）：上一版用
;   Get-CimInstance Win32_Process | ? { $_.Path -and (文件名 -ieq '...') }
; 探测进程。读取 Win32_Process.Path 需要权限，而本安装器
; （perMachine=false）以 RequestExecutionLevel user 运行；普通权限下该 CIM
; 查询直接抛 “拒绝访问 (0x80041003)”，PowerShell 退出码非 0。宏把非 0 读成
; “没有进程在运行”，于是跳过关闭、继续复制文件；被映射的
; app.asar / 可执行文件无法覆盖，安装却在没有任何可见错误的情况下结束。
;
; nsProcess 通过 Toolhelp32 快照按“进程名”枚举，不需要提升权限，因此同一
; 用户下运行的应用一定能被看到。这里不使用任何读取进程路径的接口。
;
; 编译顺序约束（2026-11-06 打包实测）：electron-builder 把本文件插入生成的
; 脚本头部，而 APP_EXECUTABLE_FILENAME 要到后面的 common.nsh 才定义。因此
; 本文件里任何“立即解析”的位置（Function 体、顶层 StrCpy）都不能直接引用
; `${APP_EXECUTABLE_FILENAME}`，否则那一趟编译会得到 warning 6000，并被
; -WX 升级成构建失败。做法是：宏在插入时（common.nsh 之后）把进程名写进
; 全局变量，函数只读这个变量。

!ifndef DSH_INSTALLER_HOOKS_INCLUDED
!define DSH_INSTALLER_HOOKS_INCLUDED

!include LogicLib.nsh

; 提升安装的判断依赖 UAC.nsh；正常流程里 multiUser.nsh 已经包含过它，
; 这里显式兜底，保证本文件通过 electron-builder 头部单独编译时也能展开。
!ifndef UAC_IsInnerInstance
  !include "UAC.nsh"
!endif

!ifndef nsProcess::FindProcess
  !include "nsProcess.nsh"
!endif

; 调用方（宏插入点）写入的目标进程名。函数体只读它，避免过早引用
; APP_EXECUTABLE_FILENAME。必须在 !ifndef 内声明：卸载器那一趟没有调用点，
; 声明了却不使用会触发 warning 6001，同样被 -WX 当成错误。
!ifndef BUILD_UNINSTALLER
Var /GLOBAL dshTargetExe
!endif

; 输出 0 = 正在运行；1 = 未在运行（探测无法给出结论时同样按 1 处理，
; 随后由关闭流程的强制分支兜底，避免再次“静默跳过”）。
!macro dsh_AppProcessRunning _FILE _RETURN
  nsProcess::_FindProcess /NOUNLOAD "${_FILE}"
  Pop $0
  ${if} $0 == 0
    StrCpy ${_RETURN} 0
  ${else}
    StrCpy ${_RETURN} 1
  ${endIf}
!macroend

; 关停顺序：
;   1) 先请求旧实例经单实例通道自行退出（不等待，避免旧版本忽略参数时挂死）；
;   2) 最多等 30 秒；
;   3) 仍未退出则强制结束同名进程，再等 10 秒；
;   4) 仍然失败就明确报错并中止安装，绝不在旧文件仍被占用时继续复制。
;
; 整个函数体必须在 !ifndef BUILD_UNINSTALLER 内：生成卸载器时会带
; BUILD_UNINSTALLER 再编一遍安装器脚本，那一趟不需要、也不应该关停应用。
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
  ; 用 Exec 而不是 ExecWait：旧版本若忽略该参数会启动一个新窗口，
  ; ExecWait 会永远等下去，安装器就卡在这里。
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
      MessageBox MB_OK|MB_ICONSTOP "$(appCannotBeClosed)"
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
!endif

; electron-builder 的默认钩子：安装段开始时调用。这里的插入发生在
; common.nsh 之后，所以 APP_EXECUTABLE_FILENAME 一定已经定义。
!macro customCheckAppRunning
  !ifndef BUILD_UNINSTALLER
    StrCpy $dshTargetExe "${APP_EXECUTABLE_FILENAME}"
    Call dsh_CloseRunningApp
  !endif
!macroend

; 提升安装（“为所有用户安装”）会让安装器以 UAC 内层实例重跑，而
; installSection.nsh 在内层实例会跳过 CHECK_APP_RUNNING。只在那种情况下
; 从 .onInit 补一次关停；普通“仅为我安装”仍要等到真正开始复制才动作，
; 取消安装不会白白关掉用户正在用的应用。
!macro customInit
  !ifndef BUILD_UNINSTALLER
  ${if} ${UAC_IsInnerInstance}
    StrCpy $dshTargetExe "${APP_EXECUTABLE_FILENAME}"
    Call dsh_CloseRunningApp
  ${endIf}
  !endif
!macroend

!endif
