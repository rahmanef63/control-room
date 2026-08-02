# Stop the local VPS Control Room servers (agent + frontend).
$ErrorActionPreference = 'SilentlyContinue'
foreach ($p in 4000, 4001) {
  Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
  }
}
Write-Host 'VPS Control Room stopped (ports 4000 + 4001 freed).'
