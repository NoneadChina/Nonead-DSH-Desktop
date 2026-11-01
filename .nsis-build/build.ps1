$ErrorActionPreference = 'Continue'
$root = 'D:\MyProgram\GitLab\nonead-dsh-desktop-essentials'
$log = Join-Path $root '.nsis-build\build.log'
Start-Transcript -Path $log -Force
$env:ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'
$env:ELECTRON_BUILDER_BINARIES_MIRROR = 'https://npmmirror.com/mirrors/electron-builder-binaries/'
Set-Location (Join-Path $root 'nonead-dsh-desktop')
Write-Output "=== NSIS build start $(Get-Date -Format o) elevated=$([Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole('Administrators')) ==="
Remove-Item 'dist\win-unpacked' -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item 'dist\Nonead-DSH-Desktop-2.2.4-x64-Setup.exe' -Force -ErrorAction SilentlyContinue
node node_modules\electron-builder\cli.js --win nsis --x64 --publish never --config.win.signExecutable=false
Write-Output "=== EXITCODE=$LASTEXITCODE $(Get-Date -Format o) ==="
Stop-Transcript
