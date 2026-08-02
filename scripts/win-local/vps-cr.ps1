# vps-cr - thin Windows wrapper over the cross-platform Node brain.
#
# Process launch (open/start/stop) uses the native PowerShell launchers for a
# nicer windowed experience; everything else (config/doctor/status/devices)
# delegates to scripts/local/control.mjs so the logic is identical on every OS.
#
#   vps-cr                 open the Control Room (start + browser)
#   vps-cr app             open the FULL dashboard in a NATIVE app window (light)
#   vps-cr term [n]        open n NATIVE terminal panes (no browser — fastest)
#   vps-cr ssh [target]    open a NATIVE ssh pane to the VPS (default: vpsku)
#   vps-cr build           build the light prod servers (fixes UI freeze)
#   vps-cr stop            stop frontend + agent
#   vps-cr install         onboarding wizard (write .env.local)
#   vps-cr config          re-run config        (--reset to regenerate secrets)
#   vps-cr doctor          diagnose             (--fix to repair)
#   vps-cr status          health of both services
#   vps-cr acc [id]        approve a login device   (list / revoke [id])
#   vps-cr secret          print a fresh secret
#   vps-cr help            full menu

$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot
$repo = Split-Path -Parent (Split-Path -Parent $here)
$brain = Join-Path $repo 'scripts\local\control.mjs'

$argList = @($args | ForEach-Object { "$_" })
$verb = ''
if ($argList.Count -gt 0) { $verb = ($argList[0] -replace '^--', '').ToLower() }

switch ($verb) {
  ''      { & (Join-Path $here 'start-control-room.ps1') }
  'open'  { & (Join-Path $here 'start-control-room.ps1') }
  'start' { & (Join-Path $here 'start-control-room.ps1') -NoBrowser }
  'build' { & (Join-Path $here 'build-control-room.ps1') }
  'app'   { & (Join-Path $here 'app.ps1') }
  'stop'  { & (Join-Path $here 'stop-control-room.ps1') }
  'term'  {
    $n = 4
    if ($argList.Count -gt 1 -and $argList[1] -match '^\d+$') { $n = [int]$argList[1] }
    & (Join-Path $here 'term.ps1') -Count $n
  }
  'ssh'   {
    $t = 'vpsku'
    if ($argList.Count -gt 1) { $t = $argList[1] }
    & (Join-Path $here 'ssh.ps1') -Target $t
  }
  default { node $brain @args }
}
