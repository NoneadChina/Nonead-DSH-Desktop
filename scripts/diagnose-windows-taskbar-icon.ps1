<#
Diagnose (and optionally repair) a blank Windows taskbar button icon for
"Nonead DSH Desktop".

Windows resolves a taskbar button icon from three places, in this order:
  1. the window's own icon      -> WM_GETICON ICON_SMALL2 / ICON_SMALL / ICON_BIG
  2. the shell shortcut whose AppUserModelID matches the window's AUMID
  3. the executable's embedded icon (large 32x32 and small 16x16)
The generic white-page placeholder appears only when all three fail. In practice
that means the application never published a window icon, or a shortcut carrying
this application's AppUserModelID no longer resolves, or the shell icon cache
still holds the blank image captured from an older build.

The NSIS installer creates its shortcuts with an explicit icon and then writes
the AppUserModelID with WinShell::SetLnkAUMI, so a shortcut that is missing
either of those was not produced by this product's installer.

Run it on the machine that shows the wrong icon, while the application runs:

  powershell -ExecutionPolicy Bypass -File diagnose-windows-taskbar-icon.ps1

Add -Fix to delete broken/legacy shortcuts and refresh the shell icon cache.
Nothing is modified without -Fix.
#>
[CmdletBinding()]
param(
  [switch]$Fix,
  [string[]]$AppId = @(
    'ai.deepseek.dsh.desktop',
    'ai.deepseek.dsh.desktop.beta',
    'ai.deepseek.dsh.desktop.next'
  ),
  [string[]]$LegacyShortcutName = @('DSH Desktop.lnk')
)

$ErrorActionPreference = 'Continue'
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class DshIconDiagnostics {
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
  [DllImport("user32.dll")] public static extern IntPtr GetClassLongPtr(IntPtr hWnd, int index);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr hWnd, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder s, int n);
  [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
  public static extern uint ExtractIconEx(string file, int index, IntPtr[] large, IntPtr[] small, uint count);
  [DllImport("user32.dll")] public static extern bool DestroyIcon(IntPtr h);
}
"@ -ErrorAction Stop

# PKEY_AppUserModel_ID: {9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3}, 5 — stored in a
# shortcut's PropertyStoreDataBlock. Its byte pattern proves the shortcut carries
# an AppUserModelID at all, which WScript.Shell cannot report.
$appUserModelIdKey = [byte[]](0x55, 0x28, 0x4C, 0x9F, 0x79, 0x9F, 0x39, 0x4B, 0xA8, 0xD0, 0xE1, 0xD4, 0x2D, 0xE1, 0xD5, 0xF3)

function Test-BytePattern {
  param([byte[]]$Data, [byte[]]$Pattern)
  if ($Data.Length -lt $Pattern.Length) { return $false }
  $last = $Data.Length - $Pattern.Length
  for ($i = 0; $i -le $last; $i++) {
    if ($Data[$i] -ne $Pattern[0]) { continue }
    $matched = $true
    for ($j = 1; $j -lt $Pattern.Length; $j++) {
      if ($Data[$i + $j] -ne $Pattern[$j]) { $matched = $false; break }
    }
    if ($matched) { return $true }
  }
  return $false
}

function Get-IconReport {
  param([IntPtr]$Handle)
  if ($Handle -eq [IntPtr]::Zero) { return $null }
  try {
    $bitmap = [System.Drawing.Icon]::FromHandle($Handle).ToBitmap()
    $pixel = $bitmap.GetPixel([int]($bitmap.Width / 2), [int]($bitmap.Height / 2))
    $report = [pscustomobject]@{
      Size   = "$($bitmap.Width)x$($bitmap.Height)"
      Centre = "ARGB($($pixel.A),$($pixel.R),$($pixel.G),$($pixel.B))"
      Green  = ($pixel.G -gt $pixel.R) -and ($pixel.G -gt $pixel.B) -and ($pixel.G -gt 90) -and ($pixel.A -gt 200)
    }
    $bitmap.Dispose()
    return $report
  } catch {
    return [pscustomobject]@{ Size = 'render-failed'; Centre = $_.Exception.Message; Green = $false }
  }
}

function Get-ShortcutRecord {
  param([string]$Path)
  $record = [pscustomobject]@{
    Path = $Path; Target = ''; TargetExists = $false; IconLocation = ''
    HasAumidProperty = $false; AppIdText = ''
  }
  try {
    $wsh = New-Object -ComObject WScript.Shell
    $link = $wsh.CreateShortcut($Path)
    $record.Target = [string]$link.TargetPath
    $record.IconLocation = [string]$link.IconLocation
    if ($record.Target) { $record.TargetExists = Test-Path -LiteralPath $record.Target }
  } catch { }
  try {
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    $record.HasAumidProperty = Test-BytePattern -Data $bytes -Pattern $appUserModelIdKey
    $found = @()
    foreach ($id in $AppId) {
      $ascii = [System.Text.Encoding]::ASCII.GetBytes($id)
      $utf16 = [System.Text.Encoding]::Unicode.GetBytes($id)
      if ((Test-BytePattern -Data $bytes -Pattern $ascii) -or (Test-BytePattern -Data $bytes -Pattern $utf16)) { $found += $id }
    }
    $record.AppIdText = ($found -join ', ')
  } catch { }
  return $record
}

Write-Output '================ (A) running window icons ================'
$processes = @(Get-Process -ErrorAction SilentlyContinue |
  Where-Object { $_.ProcessName -like '*Nonead*' -or $_.ProcessName -like '*DSH*' })
if (-not $processes) { Write-Output 'No Nonead/DSH process is running. Start the application first.' }
$windowIconSeen = $false
$windowFound = $false
foreach ($process in $processes) {
  $handle = [IntPtr]$process.MainWindowHandle
  if ($handle -eq [IntPtr]::Zero) { continue }
  $windowFound = $true
  $class = New-Object System.Text.StringBuilder 256
  [void][DshIconDiagnostics]::GetClassName($handle, $class, 256)
  $title = New-Object System.Text.StringBuilder 512
  [void][DshIconDiagnostics]::GetWindowText($handle, $title, 512)
  Write-Output "process $($process.ProcessName) pid=$($process.Id) class=$($class.ToString()) title='$($title.ToString())'"
  foreach ($slot in @(@('ICON_SMALL2', 2), @('ICON_SMALL', 0), @('ICON_BIG', 1))) {
    $report = Get-IconReport -Handle ([DshIconDiagnostics]::SendMessage($handle, 0x7F, [IntPtr]$slot[1], [IntPtr]::Zero))
    if ($null -eq $report) { Write-Output "  $($slot[0]) : null"; continue }
    Write-Output "  $($slot[0]) : $($report.Size) centre=$($report.Centre) green=$($report.Green)"
    if ($report.Green) { $windowIconSeen = $true }
  }
  $classReport = Get-IconReport -Handle ([DshIconDiagnostics]::GetClassLongPtr($handle, -14))
  if ($null -ne $classReport) {
    Write-Output "  class icon (GCLP_HICON) : $($classReport.Size) centre=$($classReport.Centre) green=$($classReport.Green)"
  }
}
if (-not $windowFound) { Write-Output 'No top-level window was found for those processes.' }

Write-Output ''
Write-Output '================ (B) installed payload ================'
$installRoots = @("$env:LOCALAPPDATA\Programs", 'C:\Program Files', 'C:\Program Files (x86)',
  "$env:ProgramFiles", "${env:ProgramFiles(x86)}", 'D:\Software', 'D:\Program Files') | Select-Object -Unique
$installations = @()
foreach ($root in $installRoots) {
  if (-not $root -or -not (Test-Path -LiteralPath $root)) { continue }
  foreach ($directory in (Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -like 'Nonead DSH*' -or $_.Name -like 'DSH Desktop*' })) {
    $applicationRoot = Join-Path $directory.FullName 'resources\app'
    if (-not (Test-Path -LiteralPath $applicationRoot)) { continue }
    $executable = Get-ChildItem -LiteralPath $directory.FullName -Filter '*.exe' -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -notlike 'Uninstall*' } | Select-Object -First 1
    $installations += [pscustomobject]@{
      Directory     = $directory.FullName
      Version       = if ($executable) { $executable.VersionInfo.FileVersion } else { 'n/a' }
      Exe           = if ($executable) { $executable.FullName } else { '' }
      ShippedIco    = Test-Path -LiteralPath (Join-Path $applicationRoot 'build\app-icon.ico')
      WindowIconFix = @(Get-ChildItem -LiteralPath (Join-Path $applicationRoot 'lib') -Filter 'application-icon-path*' -ErrorAction SilentlyContinue).Count -gt 0
    }
  }
}
if ($installations) { $installations | Format-List } else { Write-Output 'No installed Nonead DSH Desktop payload found.' }

foreach ($installation in $installations) {
  if (-not $installation.Exe) { continue }
  $large = New-Object IntPtr[] 1
  $small = New-Object IntPtr[] 1
  $count = [DshIconDiagnostics]::ExtractIconEx($installation.Exe, 0, $large, $small, 1)
  Write-Output "executable icon: $($installation.Exe) (icons=$count)"
  $rows = @()
  foreach ($pair in @(@('large 32', $large[0]), @('small 16', $small[0]))) {
    $report = Get-IconReport -Handle $pair[1]
    if ($null -eq $report) { $rows += [pscustomobject]@{ Slot = $pair[0]; Size = 'none'; Centre = '-'; Green = $false } }
    else { $rows += [pscustomobject]@{ Slot = $pair[0]; Size = $report.Size; Centre = $report.Centre; Green = $report.Green } }
    if ($pair[1] -ne [IntPtr]::Zero) { [void][DshIconDiagnostics]::DestroyIcon([IntPtr]$pair[1]) }
  }
  $rows | Format-Table -AutoSize
}

Write-Output ''
Write-Output '================ (C) AUMID registrations ================'
try {
  Get-StartApps -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like '*DSH*' -or $_.Name -like '*Nonead*' -or $AppId -contains $_.AppID } |
    Format-Table -AutoSize
} catch { Write-Output "Get-StartApps failed: $($_.Exception.Message)" }

Write-Output ''
Write-Output '================ (D) shortcuts carrying this AUMID ================'
$shortcutRoots = @(
  "$env:APPDATA\Microsoft\Windows\Start Menu\Programs",
  "$env:ProgramData\Microsoft\Windows\Start Menu\Programs",
  "$env:USERPROFILE\Desktop",
  "$env:PUBLIC\Desktop",
  "$env:APPDATA\Microsoft\Internet Explorer\Quick Launch",
  "$env:APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar"
) | Select-Object -Unique

$records = @()
foreach ($root in $shortcutRoots) {
  if (-not (Test-Path -LiteralPath $root)) { continue }
  foreach ($file in (Get-ChildItem -LiteralPath $root -Recurse -Filter '*.lnk' -ErrorAction SilentlyContinue)) {
    $record = Get-ShortcutRecord -Path $file.FullName
    $relevant = ($file.Name -like '*DSH*') -or ($file.Name -like '*Nonead*') `
      -or $record.AppIdText -or ($record.Target -like '*Nonead DSH*')
    if ($relevant) { $records += $record }
  }
}
if ($records) {
  $records | Select-Object Path, Target, TargetExists, IconLocation, HasAumidProperty, AppIdText |
    Format-List
} else { Write-Output 'No matching shortcuts found.' }

$broken = @($records | Where-Object { $_.AppIdText -and -not $_.TargetExists })
$legacy = @($records | Where-Object { $LegacyShortcutName -contains (Split-Path -Leaf $_.Path) })
$iconless = @($records | Where-Object {
  $_.AppIdText -and $_.TargetExists -and (($_.IconLocation -eq '') -or ($_.IconLocation -like ',*'))
})

Write-Output ''
Write-Output '================ verdict ================'
Write-Output "window icon visible          : $windowIconSeen"
Write-Output "broken AUMID shortcuts       : $($broken.Count)"
Write-Output "legacy-name shortcuts        : $($legacy.Count)"
Write-Output "AUMID shortcut w/o icon      : $($iconless.Count)"
if (-not $windowIconSeen) {
  Write-Output ''
  Write-Output 'The application did not publish a window icon. That is an application-side defect:'
  Write-Output 'the packaged build is missing the startup icon registration, not a shell cache problem.'
} elseif ($broken.Count -gt 0) {
  Write-Output ''
  Write-Output 'A shortcut carrying this application AppUserModelID no longer resolves. Windows prefers'
  Write-Output 'that shortcut over the window icon, which produces the blank placeholder.'
} elseif ($iconless.Count -gt 0) {
  Write-Output ''
  Write-Output 'A shortcut carrying this application AppUserModelID has no explicit icon. The installer'
  Write-Output 'always writes one, so this shortcut came from somewhere else and can shadow the correct'
  Write-Output 'one, leaving the taskbar button on the generic placeholder.'
} else {
  Write-Output ''
  Write-Output 'No broken shortcut was found. The blank image is most likely the shell icon cache still'
  Write-Output 'holding an icon captured from an older build.'
}

if (-not $Fix) {
  Write-Output ''
  Write-Output 'Read-only run. Pass -Fix to delete the broken/legacy/iconless shortcuts listed above and'
  Write-Output 'to refresh the shell icon cache.'
  return
}

Write-Output ''
Write-Output '================ repairing ================'
foreach ($record in ($broken + $legacy + $iconless | Sort-Object -Property Path -Unique)) {
  try {
    Remove-Item -LiteralPath $record.Path -Force -ErrorAction Stop
    Write-Output "removed $($record.Path)"
  } catch { Write-Output "failed to remove $($record.Path): $($_.Exception.Message)" }
}

Write-Output 'restarting explorer to rebuild the shell icon cache...'
$cacheFiles = @()
$localIconCache = Join-Path $env:LOCALAPPDATA 'IconCache.db'
if (Test-Path -LiteralPath $localIconCache) { $cacheFiles += $localIconCache }
$explorerCache = Join-Path $env:LOCALAPPDATA 'Microsoft\Windows\Explorer'
if (Test-Path -LiteralPath $explorerCache) {
  $cacheFiles += @(Get-ChildItem -LiteralPath $explorerCache -Filter 'iconcache*.db' -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty FullName)
}
try {
  Stop-Process -Name explorer -Force -ErrorAction Stop
  Start-Sleep -Seconds 3
  foreach ($file in $cacheFiles) {
    try { Remove-Item -LiteralPath $file -Force -ErrorAction Stop; Write-Output "removed $file" }
    catch { Write-Output "could not remove $file (in use): $($_.Exception.Message)" }
  }
} catch { Write-Output "could not stop explorer: $($_.Exception.Message)" }
if (-not (Get-Process -Name explorer -ErrorAction SilentlyContinue)) { Start-Process explorer.exe }
Write-Output ''
Write-Output 'Restart the application and check the taskbar button again. If the start menu or desktop'
Write-Output 'entry disappeared, run the installer again and choose Repair so it recreates a shortcut'
Write-Output 'with both the explicit icon and the AppUserModelID.'
