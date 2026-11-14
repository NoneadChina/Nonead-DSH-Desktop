; Nonead DSH Desktop — Inno Setup 安装脚本
;
; 由 scripts/package-inno.ts 调用，所有随构建变化的量都通过 /D 传入：
;   AppVersion  产品版本（取自 nonead-dsh-desktop/package.json）
;   AppArch     x64 | arm64
;   SourceDir   electron-builder 产出的 unpacked 目录
;   OutputDir   安装包输出目录
;   IconFile    安装包图标（默认 ..\build\app-icon.ico，源自 build/app-icon.png）
;
; 硬性要求（2026-11-14 用户指令）：
;   · x86(x64) 与 ARM64 各一份单文件可执行安装包
;   · 默认安装路径 C:\Program Files\Nonead DSH Desktop
;   · 安装前主动关闭正在运行的 Nonead DSH Desktop
;   · 卸载前同样主动关闭正在运行的 Nonead DSH Desktop

#define AppName "Nonead DSH Desktop"
#define AppPublisher "拓德科技 (NONEAD)"
#define AppExeName "Nonead DSH Desktop.exe"
#define AppUrl "https://nonead.com"

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif
#ifndef AppArch
  #define AppArch "x64"
#endif
#ifndef SourceDir
  #error 缺少 SourceDir：请用 /DSourceDir=<unpacked 目录> 调用 ISCC
#endif
#ifndef OutputDir
  #define OutputDir "."
#endif
#ifndef IconFile
  #define IconFile "..\build\app-icon.ico"
#endif

#if AppArch == "arm64"
  #define ArchAllowed "arm64"
  #define ArchInstallMode "arm64"
#else
  #define ArchAllowed "x64compatible"
  #define ArchInstallMode "x64compatible"
#endif

[Setup]
; 固定的产品标识：升级安装会复用同一条卸载记录
AppId={{B3E7C1D9-4A26-4F58-8C31-6D9E5A2B7C44}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppUrl}
AppSupportURL={#AppUrl}
AppUpdatesURL={#AppUrl}
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
AllowNoIcons=yes
OutputDir={#OutputDir}
OutputBaseFilename=Nonead-DSH-Desktop-{#AppVersion}-{#AppArch}-Setup
SetupIconFile={#IconFile}
UninstallDisplayIcon={app}\{#AppExeName}
UninstallDisplayName={#AppName} {#AppVersion}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesAllowed={#ArchAllowed}
ArchitecturesInstallIn64BitMode={#ArchInstallMode}
; 进程由下方 [Code] 主动结束，交给 Restart Manager 反而会弹「文件被占用」对话框
CloseApplications=no
RestartApplications=no
MinVersion=10.0
; 优先按 Windows 显示语言自动选语言；只在无法判定（例如系统语言没有对应 .isl）时才弹语言选择框。
; 想让用户每次都能自选，把下一行改成 ShowLanguageDialog=yes。
LanguageDetectionMethod=uilanguage
ShowLanguageDialog=auto
VersionInfoVersion={#AppVersion}
VersionInfoCompany={#AppPublisher}
VersionInfoDescription={#AppName} 安装程序
VersionInfoProductName={#AppName}
VersionInfoProductVersion={#AppVersion}
VersionInfoCopyright=Copyright (C) 2026 {#AppPublisher}

[Languages]
; 与仓库文档一致的 8 种语言（中文 / English / 日本語 / Español / Français / Deutsch / Русский / Português）。
; 全部取自 Inno Setup 7.1.1 自带的 Default.isl 与 Languages\*.isl，不需要额外下载：
;   C:\Program Files\Inno Setup 7\Default.isl
;   C:\Program Files\Inno Setup 7\Languages\{ChineseSimplified,German,Spanish,French,Japanese,BrazilianPortuguese,Russian}.isl
; Name 与 .isl 的 LanguageName 相同，[CustomMessages] 里按这些名字做语言前缀。
Name: "chinesesimplified"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "japanese"; MessagesFile: "compiler:Languages\Japanese.isl"
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"
Name: "french"; MessagesFile: "compiler:Languages\French.isl"
Name: "german"; MessagesFile: "compiler:Languages\German.isl"
Name: "russian"; MessagesFile: "compiler:Languages\Russian.isl"
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExeName}"
Name: "{group}\{cm:UninstallProgram,{#AppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(AppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[CustomMessages]
; [Code] 里两处 MsgBox 的文案。键名写 <LanguageName>.<Key> 只覆盖该语言；
; 不带前缀的那条是兜底（英语），任何语言缺键时都会回落到它。
CannotCloseAppInstall=Cannot close the running Nonead DSH Desktop.
CannotCloseAppInstallHint=Quit it manually, then run this installer again.
CannotCloseAppUninstall=Cannot close the running Nonead DSH Desktop.
CannotCloseAppUninstallHint=Quit it manually and run the uninstaller again, so no in-use files are left behind.
chinesesimplified.CannotCloseAppInstall=无法关闭正在运行的 Nonead DSH Desktop，安装已取消。
chinesesimplified.CannotCloseAppInstallHint=请手动退出该程序后重新运行安装包。
chinesesimplified.CannotCloseAppUninstall=无法关闭正在运行的 Nonead DSH Desktop。
chinesesimplified.CannotCloseAppUninstallHint=请手动退出该程序后再次卸载，以免残留被占用的文件。
japanese.CannotCloseAppInstall=実行中の Nonead DSH Desktop を終了できませんでした。インストールを中止します。
japanese.CannotCloseAppInstallHint=手動で終了してから、もう一度インストーラーを実行してください。
japanese.CannotCloseAppUninstall=実行中の Nonead DSH Desktop を終了できませんでした。
japanese.CannotCloseAppUninstallHint=手動で終了してから、もう一度アンインストーラーを実行してください。使用中のファイルが残らないようにします。
spanish.CannotCloseAppInstall=No se pudo cerrar Nonead DSH Desktop en ejecución. La instalación se ha cancelado.
spanish.CannotCloseAppInstallHint=Ciérrelo manualmente y vuelva a ejecutar el instalador.
spanish.CannotCloseAppUninstall=No se pudo cerrar Nonead DSH Desktop en ejecución.
spanish.CannotCloseAppUninstallHint=Ciérrelo manualmente y vuelva a ejecutar el desinstalador para no dejar archivos en uso.
french.CannotCloseAppInstall=Impossible de fermer Nonead DSH Desktop en cours d'exécution. L'installation est annulée.
french.CannotCloseAppInstallHint=Quittez-le manuellement, puis relancez l'installeur.
french.CannotCloseAppUninstall=Impossible de fermer Nonead DSH Desktop en cours d'exécution.
french.CannotCloseAppUninstallHint=Quittez-le manuellement, puis relancez le désinstalleur pour ne laisser aucun fichier verrouillé.
german.CannotCloseAppInstall=Das laufende Nonead DSH Desktop konnte nicht beendet werden. Die Installation wurde abgebrochen.
german.CannotCloseAppInstallHint=Beenden Sie es manuell und starten Sie das Setup erneut.
german.CannotCloseAppUninstall=Das laufende Nonead DSH Desktop konnte nicht beendet werden.
german.CannotCloseAppUninstallHint=Beenden Sie es manuell und starten Sie die Deinstallation erneut, damit keine gesperrten Dateien zurückbleiben.
russian.CannotCloseAppInstall=Не удалось закрыть запущенный Nonead DSH Desktop. Установка отменена.
russian.CannotCloseAppInstallHint=Закройте его вручную и запустите установщик снова.
russian.CannotCloseAppUninstall=Не удалось закрыть запущенный Nonead DSH Desktop.
russian.CannotCloseAppUninstallHint=Закройте его вручную и запустите деинсталлятор снова, чтобы не остались занятые файлы.
brazilianportuguese.CannotCloseAppInstall=Não foi possível fechar o Nonead DSH Desktop em execução. A instalação foi cancelada.
brazilianportuguese.CannotCloseAppInstallHint=Feche-o manualmente e execute o instalador novamente.
brazilianportuguese.CannotCloseAppUninstall=Não foi possível fechar o Nonead DSH Desktop em execução.
brazilianportuguese.CannotCloseAppUninstallHint=Feche-o manualmente e execute o desinstalador novamente para não deixar arquivos em uso.

[Code]
const
  AppImageName = 'Nonead DSH Desktop.exe';

{ 结束所有 Nonead DSH Desktop 进程（含 Electron 子进程）。
  taskkill 返回 128 表示已无匹配进程：那时才算成功。 }
function KillAppProcesses(): Boolean;
var
  ResultCode: Integer;
  Attempt: Integer;
begin
  Result := False;
  for Attempt := 1 to 40 do
  begin
    if not Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /T /IM "' + AppImageName + '"',
      '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
      Exit;
    if ResultCode = 128 then
    begin
      Result := True;
      Exit;
    end;
    Sleep(250);
  end;
end;

function InitializeSetup(): Boolean;
begin
  Result := True;
  if not KillAppProcesses() then
  begin
    MsgBox(ExpandConstant('{cm:CannotCloseAppInstall}') + #13#10 +
      ExpandConstant('{cm:CannotCloseAppInstallHint}'), mbError, MB_OK);
    Result := False;
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usUninstall then
  begin
    if not KillAppProcesses() then
      MsgBox(ExpandConstant('{cm:CannotCloseAppUninstall}') + #13#10 +
        ExpandConstant('{cm:CannotCloseAppUninstallHint}'), mbError, MB_OK);
  end;
end;
