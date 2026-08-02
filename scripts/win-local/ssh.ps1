# vps-cr ssh [target] — open a NATIVE SSH pane to your VPS in Windows Terminal.
# Default target is the `vpsku` ssh-config alias. One native tool for both local
# shells (vps-cr term) and the remote box — no browser, no dashboard needed.
param([string]$Target = 'vpsku')
$ErrorActionPreference = 'Stop'

if (Get-Command wt -ErrorAction SilentlyContinue) {
  Start-Process wt -ArgumentList @('new-tab', '--title', "ssh:$Target", 'ssh', $Target)
} else {
  Start-Process ssh -ArgumentList $Target
}
Write-Host "Opening native SSH session to '$Target'."
