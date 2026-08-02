# Start the VPS Control Room FRONTEND locally on Windows.
# Uses the PRODUCTION server (next start) when a build exists — far lighter on
# CPU than `next dev` (no on-demand compile, no Strict-Mode double-render), so
# opening many terminal panes no longer freezes the UI. Falls back to `next dev`
# if you haven't built yet.  Build/refresh with:  vps-cr build
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$fe = Join-Path $repo 'frontend'

# Stable build id so the PWA VersionGuard doesn't nag on local runs ('unknown'
# is the guard's dev escape-hatch — it skips the version check entirely).
$env:NEXT_PUBLIC_BUILD_ID = 'unknown'

# Honor CONTROL_ROOM_HOST / CONTROL_ROOM_PORT like the cross-platform brain does;
# default to loopback:4000 for local runs (don't expose the dashboard on every NIC).
$feHost = if ($env:CONTROL_ROOM_HOST) { $env:CONTROL_ROOM_HOST } else { '127.0.0.1' }
$fePort = if ($env:CONTROL_ROOM_PORT) { $env:CONTROL_ROOM_PORT } else { '4000' }

if (Test-Path (Join-Path $fe '.next\BUILD_ID')) {
  Write-Host "Frontend starting on http://${feHost}:${fePort} (PROD build - light)"
  npm --prefix $fe run start -- --hostname $feHost --port $fePort
} else {
  Write-Host "Frontend starting on http://${feHost}:${fePort} (dev mode - run 'vps-cr build' for the lighter prod server)"
  npm --prefix $fe run dev -- --hostname $feHost --port $fePort
}
