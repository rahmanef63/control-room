# vps-cr term [n] — open N NATIVE terminal panes in Windows Terminal.
#
# The local fast-path for "I just want a bunch of shells". Native, GPU-accelerated
# (no browser, no xterm.js, no React, no SSE) — ~tens of MB for many panes vs
# multiple GB rendering the same panes inside a browser tab. Use the web dashboard
# only when you want its visual features (file browser, host stats, AI panes).
param([int]$Count = 4)
$ErrorActionPreference = 'Stop'

if ($Count -lt 1) { $Count = 1 }
if ($Count -gt 16) { $Count = 16 }   # past ~16 panes a single tab gets unreadable

if (-not (Get-Command wt -ErrorAction SilentlyContinue)) {
  Write-Host "Windows Terminal (wt) not found. Install it from the Microsoft Store, then retry."
  Write-Host "Fallback: opening $Count separate PowerShell windows."
  for ($i = 0; $i -lt $Count; $i++) { Start-Process powershell }
  return
}

# Build one tab, then split it (Count-1) times. Alternate -H/-V so the panes tile
# into a readable grid instead of slivers.
$wtArgs = @('new-tab')
for ($i = 1; $i -lt $Count; $i++) {
  $dir = if ($i % 2 -eq 1) { '-V' } else { '-H' }
  $wtArgs += @(';', 'split-pane', $dir)
}

Start-Process wt -ArgumentList $wtArgs
Write-Host "Opened $Count native terminal panes in Windows Terminal (GPU, ~tiny RAM, no browser)."
