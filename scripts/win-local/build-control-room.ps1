# Build the VPS Control Room for a LIGHT local prod run.
# After this, `vps-cr` / `vps-cr start` launch the production servers
# (next start + node dist) instead of the heavy dev servers, which fixes the
# CPU freeze when opening many terminal panes. Re-run after pulling changes.
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

# Skip the PWA version toast on local prod builds.
$env:NEXT_PUBLIC_BUILD_ID = 'unknown'

Write-Host '== Building frontend (next build) - this can take 1-3 min =='
npm --prefix (Join-Path $repo 'frontend') run build

Write-Host '== Building agent (tsc) =='
npm --prefix (Join-Path $repo 'agent') run build

Write-Host ''
Write-Host 'Build done. Run  vps-cr  (browser) or  vps-cr start  (no browser) to launch the light prod servers.'
