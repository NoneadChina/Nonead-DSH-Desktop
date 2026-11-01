$ErrorActionPreference = 'Continue'
$root = 'D:\MyProgram\GitLab\nonead-dsh-desktop-essentials'
$log = Join-Path $root '.nsis-build\build2.log'
Remove-Item $log -Force -ErrorAction SilentlyContinue
& "`C:\Program Files\nodejs\node.exe`" --version 2>&1 | Out-File -Append -Encoding utf8 $log
"node check exit=$LASTEXITCODE" | Out-File -Append -Encoding utf8 $log
$env:ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'
$env:ELECTRON_BUILDER_BINARIES_MIRROR = 'https://npmmirror.com/mirrors/electron-builder-binaries/'
Set-Location (Join-Path $root 'nonead-dsh-desktop')
Remove-Item 'dist\win-unpacked' -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item 'dist\Nonead-DSH-Desktop-2.2.4-x64-Setup.exe' -Force -ErrorAction SilentlyContinue
"=== build start elevated=$([Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole('Administrators')) ===" | Out-File -Append -Encoding utf8 $log
cmd /c ""`C:\Program Files\nodejs\node.exe`" node_modules\electron-builder\cli.js --win nsis --x64 --publish never --config.win.signExecutable=false >> "$log" 2>&1"
"=== EXITCODE=$LASTEXITCODE ===" | Out-File -Append -Encoding utf8 $log
