# VPS Control Room - LOCAL one-liner installer (Windows, native - no WSL).
#
# Usage:
#   irm https://raw.githubusercontent.com/rahmanef63/control-room/main/install.ps1 | iex
#
# What it does (re-runnable; skips anything already done):
#   1. Verifies Node 18+, git
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
Need node "install Node 18+: https://nodejs.org/"
$nodeMajor = [int]((node -v) -replace 'v(\d+).*', '$1')
if ($nodeMajor -lt 18) { Write-Host "Node $nodeMajor detected; need 18+." -ForegroundColor Red; exit 1 }
Write-Host "  Node $(node -v) ok" -ForegroundColor Green
Need git "install git: https://git-scm.com/"
Write-Host "  git ok" -ForegroundColor Green

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
npm --prefix frontend install
npm --prefix agent install
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
