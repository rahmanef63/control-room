# vps-cr app — open the FULL dashboard in a NATIVE app window.
#
# Same terminal-focused web UI (panes, workspaces, history, templates, file/cwd
# helpers, host status, settings), hosted in a lightweight chromeless
# WebView2/Edge "app" window with its own taskbar icon and a DEDICATED profile —
# NOT inside your heavy everyday browser (Comet was ~40 procs / 6 GB). This window
# is its own small process tree (a few hundred MB) and GPU-accelerated.
#
# Starts the (prod) servers first unless they're already up.
param([switch]$NoStart)
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot
$url = 'http://localhost:4000'

if (-not $NoStart) {
  & (Join-Path $here 'start-control-room.ps1') -NoBrowser | Out-Host
}

$edge = @(
  'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
  'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
) | Where-Object { Test-Path $_ } | Select-Object -First 1
$chrome = @(
  'C:\Program Files\Google\Chrome\Application\chrome.exe',
  'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
) | Where-Object { Test-Path $_ } | Select-Object -First 1

$browser = if ($edge) { $edge } elseif ($chrome) { $chrome } else { $null }
if (-not $browser) {
  Write-Host 'No Edge/Chrome found for app mode - opening your default browser instead.'
  Start-Process $url
  return
}

# Dedicated user-data-dir keeps this app window isolated + light (its own process
# tree, separate from your main browser).
$profileDir = Join-Path $env:LOCALAPPDATA 'vps-cr-app'
$appArgs = @(
  "--app=$url",
  "--user-data-dir=$profileDir",
  '--window-size=1400,900',
  '--no-first-run',
  '--no-default-browser-check'
)
Start-Process $browser -ArgumentList $appArgs
$which = if ($edge) { 'Edge WebView2' } else { 'Chrome' }
Write-Host "Control Room opened as a native app window ($which) - all features, light. Close it like any app; servers keep running ('vps-cr stop' to free them)."
