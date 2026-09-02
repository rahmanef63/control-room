# VPS Control Room - LOCAL one-liner installer (Windows, native - no WSL).
#
# Usage:
#   irm https://raw.githubusercontent.com/rahmanef63/control-room/main/install.ps1 | iex
#
# What it does (re-runnable; skips anything already done):
#   1. Verifies Node 22+ (production frontend + agent run on Node) and git; installs Bun
#   2. Clones (or pulls) the repo
#   3. Generates .env.local with fresh secrets (node crypto, no openssl)
#   4. Installs frontend + agent deps
#   5. Wires up the `vps-cr` command in your PowerShell profile
#
# LOCAL-only: no VPS / SSH / systemd / Tailscale / domain involved.

$ErrorActionPreference = 'Stop'
$RepoUrl = if ($env:REPO_URL) { $env:REPO_URL } else { 'https://github.com/rahmanef63/control-room.git' }
$InstallDir = if ($env:INSTALL_DIR) { $env:INSTALL_DIR } else { Join-Path $HOME 'vps-control-room' }

function Need($cmd, $hint) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Write-Host "Missing: $cmd - $hint" -ForegroundColor Red; exit 1
  }
}

Write-Host ""
Write-Host "  +----------------------------------------------+" -ForegroundColor Cyan
Write-Host "  |  VPS CONTROL ROOM - local installer          |" -ForegroundColor Cyan
Write-Host "  |  runs on your laptop, no VPS required         |" -ForegroundColor Cyan
Write-Host "  +----------------------------------------------+" -ForegroundColor Cyan
Write-Host ""

Write-Host "-> Checking prerequisites..." -ForegroundColor Cyan
Need node "install Node 22+: https://nodejs.org/"
$nodeMajor = [int]((node -v) -replace 'v(\d+).*', '$1')
if ($nodeMajor -lt 22) { Write-Host "Node $nodeMajor detected; need 22+." -ForegroundColor Red; exit 1 }
Write-Host "  Node $(node -v) ok" -ForegroundColor Green
Need git "install git: https://git-scm.com/"
Write-Host "  git ok" -ForegroundColor Green
# Bun is the package/test/build toolchain; production adapter-node and the PTY agent run on Node 22.
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
  Write-Host "  bun not found - installing from https://bun.sh ..." -ForegroundColor Yellow
  powershell -NoProfile -Command "irm bun.sh/install.ps1 | iex"
  $bunBin = if ($env:BUN_INSTALL) { Join-Path $env:BUN_INSTALL 'bin' } else { Join-Path $HOME '.bun\bin' }
  $env:PATH = "$bunBin;$env:PATH"
}
Need bun "install bun: https://bun.sh/ (then reopen PowerShell)"
Write-Host "  bun $(bun --version) ok" -ForegroundColor Green

Write-Host "-> Cloning workspace..." -ForegroundColor Cyan
if (Test-Path (Join-Path $InstallDir '.git')) {
  Write-Host "  $InstallDir exists; pulling latest" -ForegroundColor Yellow
  try { git -C $InstallDir pull --ff-only } catch { Write-Host "  (pull skipped - local changes present)" -ForegroundColor Yellow }
} elseif (Test-Path $InstallDir) {
  Write-Host "Path exists but is not a git repo: $InstallDir" -ForegroundColor Red; exit 1
} else {
  git clone $RepoUrl $InstallDir
}
Set-Location $InstallDir
Write-Host "  Workspace ready at $InstallDir ok" -ForegroundColor Green

Write-Host "-> Generating .env.local (fresh secrets)..." -ForegroundColor Cyan
node scripts\local\control.mjs config --yes --no-install
Write-Host "  .env.local ready ok" -ForegroundColor Green

Write-Host "-> Installing deps (frontend + agent)..." -ForegroundColor Cyan
bun install --cwd frontend
bun install --cwd agent
Write-Host "  deps installed ok" -ForegroundColor Green

Write-Host "-> Wiring up the vps-cr command..." -ForegroundColor Cyan
& (Join-Path $InstallDir 'scripts\win-local\install-vps-cr-command.ps1')

Write-Host ""
Write-Host "================================================" -ForegroundColor White
Write-Host "  Install complete!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor White
Write-Host @"

Next steps (open a NEW PowerShell window first, so 'vps-cr' is loaded):

  1) Set your login password (optional, recommended):
       vps-cr config

  2) Start it (opens your browser when ready):
       vps-cr

  3) Log in with the password from step 1 - this machine is auto-trusted
     locally, so there's nothing else to approve.

  Useful:  vps-cr doctor  .  vps-cr status  .  vps-cr stop  .  vps-cr help

"@
Write-Host "Happy building." -ForegroundColor Cyan
