$ErrorActionPreference = 'Continue'
$root = 'D:\MyProgram\GitLab\nonead-dsh-desktop-essentials'
$log = Join-Path $root '.nsis-build\build19.log'
Remove-Item $log -Force -ErrorAction SilentlyContinue
$node = 'C:\Program Files\nodejs\node.exe'
$isAdmin = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole('Administrators')
"=== start admin=$isAdmin $(Get-Date -Format o) ===" | Out-File -Append -Encoding utf8 $log
$env:ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'
$env:ELECTRON_BUILDER_BINARIES_MIRROR = 'https://npmmirror.com/mirrors/electron-builder-binaries/'
Set-Location (Join-Path $root 'nonead-dsh-desktop')
Remove-Item 'dist\win-unpacked' -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item 'dist\Nonead-DSH-Desktop-2.2.4-x64-Setup.exe' -Force -ErrorAction SilentlyContinue
"=== reseal payload $(Get-Date -Format o) ===" | Out-File -Append -Encoding utf8 $log
$pcmd = '"' + $node + '" scripts\prepare-payload.ts --platform win32 >> "' + $log + '" 2>&1'
cmd /c $pcmd
"=== payload exit=$LASTEXITCODE $(Get-Date -Format o) ===" | Out-File -Append -Encoding utf8 $log
"=== build nsis $(Get-Date -Format o) ===" | Out-File -Append -Encoding utf8 $log
$cmd = '"' + $node + '" node_modules\electron-builder\cli.js --win nsis --x64 --publish never --config.win.signExecutable=false >> "' + $log + '" 2>&1'
cmd /c $cmd
"=== EXITCODE=$LASTEXITCODE $(Get-Date -Format o) ===" | Out-File -Append -Encoding utf8 $log













