# One-click launcher for VPS Control Room (local, Windows).
# Starts the agent + frontend if they aren't already running, waits until the
# dashboard responds, then opens it in your default browser.
# Pass -NoBrowser to start the services only (no browser window — saves RAM).
param([switch]$NoBrowser)
$ErrorActionPreference = 'SilentlyContinue'
$here = $PSScriptRoot

function PortUp([int]$p) {
  [bool](Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue)
}

# Start the agent (port 4001) if it's down — own minimized window so it survives
# and you can see logs / Ctrl+C to stop it.
if (-not (PortUp 4001)) {
  Start-Process powershell -WindowStyle Minimized -ArgumentList @(
    '-ExecutionPolicy','Bypass','-NoExit','-File',"`"$here\start-agent.ps1`""
  )
}

# Start the frontend (port 4000) if it's down.
if (-not (PortUp 4000)) {
  Start-Process powershell -WindowStyle Minimized -ArgumentList @(
    '-ExecutionPolicy','Bypass','-NoExit','-File',"`"$here\start-frontend.ps1`""
  )
}

# Wait for the dashboard to actually answer (first compile can take a few sec).
$deadline = (Get-Date).AddSeconds(120)
$ready = $false
while ((Get-Date) -lt $deadline) {
  try {
    $r = Invoke-WebRequest 'http://localhost:4000/login' -UseBasicParsing -TimeoutSec 4
    if ($r.StatusCode -eq 200) { $ready = $true; break }
  } catch {}
  Start-Sleep -Milliseconds 1500
}

if ($NoBrowser) {
  Write-Host ('Control Room services are ' + $(if ($ready) { 'up' } else { 'starting' }) + ' at http://localhost:4000 (no browser opened).')
} else {
  # Open it regardless — if not quite ready the browser will just retry on refresh.
  Start-Process 'http://localhost:4000'
  if (-not $ready) {
    Write-Host 'Dashboard is still starting — give it a few seconds and refresh the page.'
  }
}
