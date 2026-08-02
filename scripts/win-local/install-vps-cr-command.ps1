# Wire up the short `vps-cr` command by adding a function to your PowerShell
# profile. Run this ONCE. After it finishes, open a NEW PowerShell window and
# type `vps-cr` from anywhere.
$ErrorActionPreference = 'Stop'
$engine = Join-Path $PSScriptRoot 'vps-cr.ps1'

$marker = '# >>> vps-cr command >>>'
$endMarker = '# <<< vps-cr command <<<'
$block = @"
$marker
function vps-cr { & '$engine' @args }
$endMarker
"@

$profilePath = $PROFILE.CurrentUserAllHosts
$dir = Split-Path -Parent $profilePath
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }

$existing = ''
if (Test-Path $profilePath) { $existing = Get-Content $profilePath -Raw }

if ($existing -match [regex]::Escape($marker)) {
  # Strip the old block (re-run picks up a new engine path), then re-append.
  $pattern = [regex]::Escape($marker) + '.*?' + [regex]::Escape($endMarker)
  $stripped = [regex]::Replace($existing, $pattern, '', 'Singleline').TrimEnd()
  Set-Content -Path $profilePath -Value "$stripped`r`n`r`n$block`r`n" -Encoding UTF8
} else {
  Add-Content -Path $profilePath -Value "`r`n$block`r`n" -Encoding UTF8
}

Write-Host "Installed 'vps-cr' into: $profilePath" -ForegroundColor Green
Write-Host "Open a NEW PowerShell window, then try:  vps-cr list" -ForegroundColor Green
