# Build VPS Control Room for a light local production run.
# Frontend: SvelteKit adapter-node build for Node 22. Agent: Node 22 build output.
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

$env:PUBLIC_BUILD_ID = 'dev-local'

Write-Host '== Checking frontend (Svelte) =='
bun run --cwd (Join-Path $repo 'frontend') check

Write-Host '== Testing frontend =='
bun run --cwd (Join-Path $repo 'frontend') test

Write-Host '== Building frontend (SvelteKit adapter-node) =='
bun run --cwd (Join-Path $repo 'frontend') build

Write-Host '== Building agent (tsc) =='
bun run --cwd (Join-Path $repo 'agent') build

Write-Host ''
Write-Host 'Build done. Run vps-cr (browser) or vps-cr start (no browser).'
