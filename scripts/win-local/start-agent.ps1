# Start the VPS Control Room AGENT locally on Windows.
# Loads repo-root .env.local into the process env (the agent reads process.env
# directly; only systemd injects it in production) and runs the dev server.
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$envFile = Join-Path $repo '.env.local'

Get-Content $envFile | ForEach-Object {
  $line = $_.Trim()
  if ($line -and -not $line.StartsWith('#') -and $line.Contains('=')) {
    $idx = $line.IndexOf('=')
    $k = $line.Substring(0, $idx).Trim()
    $v = $line.Substring($idx + 1).Trim()
    # Strip matching surrounding quotes so KEY="value" yields value, not "value"
    # (the cross-platform brain in control.mjs does the same — keep them in sync).
    if ($v.Length -ge 2 -and (($v[0] -eq '"' -and $v[-1] -eq '"') -or ($v[0] -eq "'" -and $v[-1] -eq "'"))) {
      $v = $v.Substring(1, $v.Length - 2)
    }
    Set-Item -Path "env:$k" -Value $v
  }
}

$agent = Join-Path $repo 'agent'
if (Test-Path (Join-Path $agent 'dist\index.js')) {
  Write-Host "Agent starting on $($env:AGENT_HEALTH_HOST):$($env:AGENT_HEALTH_PORT) (prod build, shell=$($env:SHELL))"
  npm --prefix $agent run start
} else {
  Write-Host "Agent starting on $($env:AGENT_HEALTH_HOST):$($env:AGENT_HEALTH_PORT) (dev, shell=$($env:SHELL))"
  npm --prefix $agent run dev
}
