# 重新生成 src/client/assets.ts（把两张品牌 logo 编码为 base64 data URL）。
# 用法: pwsh -File scripts/make-assets.ps1
$root = Split-Path -Parent $PSScriptRoot
$expanded = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $root 'NONEAD_ai.png')))
$rail = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $root 'nonead.ai_Logo.png')))
$content = @"
/**
 * 生成文件：两张品牌 logo 的 base64 data URL（由 scripts/make-assets.ps1 生成，勿手改）。
 * - EXPANDED_LOGO_DATA_URL: NONEAD_ai.png（1790x200，展开态导航栏品牌区）
 * - RAIL_LOGO_DATA_URL: nonead.ai_Logo.png（486x486，收起态 rail 顶部）
 */
export const EXPANDED_LOGO_DATA_URL = 'data:image/png;base64,$expanded'
export const RAIL_LOGO_DATA_URL = 'data:image/png;base64,$rail'

"@
[IO.File]::WriteAllText((Join-Path $root 'src\client\assets.ts'), $content, (New-Object Text.UTF8Encoding($false)))
Write-Host 'assets.ts regenerated'