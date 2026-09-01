# Start the VPS Control Room SvelteKit frontend locally on Windows.
# Uses the adapter-node production build when available; otherwise falls back
# to Vite dev. Build/refresh with: vps-cr build
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$fe = Join-Path $repo 'frontend'

# Stable local build id so the PWA version guard does not treat every restart as
# a new production release.
$env:PUBLIC_BUILD_ID = 'dev-local'

$feHost = if ($env:CONTROL_ROOM_HOST) { $env:CONTROL_ROOM_HOST } else { '127.0.0.1' }
$fePort = if ($env:CONTROL_ROOM_PORT) { $env:CONTROL_ROOM_PORT } else { '4000' }
$env:HOST = $feHost
$env:PORT = $fePort

if (Test-Path (Join-Path $fe 'build\index.js')) {
  Write-Host "Frontend starting on http://${feHost}:${fePort} (adapter-node production build)"
  bun run --cwd $fe start
} else {
  Write-Host "Frontend starting on http://${feHost}:${fePort} (Vite dev - run 'vps-cr build' for production mode)"
  bun run --cwd $fe dev -- --host $feHost --port $fePort
}
