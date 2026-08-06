#!/usr/bin/env bash
# VPS Control Room — LOCAL one-liner installer (macOS / Linux).
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/rahmanef63/control-room/main/install.sh | bash
#
# What it does (re-runnable; skips anything already done):
#   1. Verifies Node 18+ (the agent daemon runs on node) and git; installs bun
#   2. Clones (or pulls) the repo
#   3. Generates .env.local with fresh secrets (node crypto, no openssl)
#   4. Installs frontend + agent deps
#   5. Links `vps-cr` onto your PATH
#
# This is LOCAL-only: no VPS / SSH / systemd / Tailscale / domain involved.

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/rahmanef63/control-room.git}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/vps-control-room}"

cyan()   { printf "\033[36m%s\033[0m\n" "$*"; }
green()  { printf "\033[32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
red()    { printf "\033[31m%s\033[0m\n" "$*"; }
bold()   { printf "\033[1m%s\033[0m\n" "$*"; }
need()   { command -v "$1" >/dev/null 2>&1 || { red "Missing: $1 — $2"; exit 1; }; }

cat <<'EOF'

  ╭──────────────────────────────────────────────╮
  │  VPS CONTROL ROOM — local installer          │
  │  runs on your laptop, no VPS required         │
  ╰──────────────────────────────────────────────╯
EOF

cyan "→ Checking prerequisites…"
need node "install Node 18+: https://nodejs.org/"
node_major=$(node -v | sed -E 's/v([0-9]+).*/\1/')
if [ "$node_major" -lt 18 ]; then red "Node $node_major detected; need 18+."; exit 1; fi
green "  Node $(node -v) ✓"
need git "install git: https://git-scm.com/"
green "  git $(git --version | awk '{print $3}') ✓"
# bun is the package manager + frontend runtime; node stays for the agent daemon.
if ! command -v bun >/dev/null 2>&1; then
  yellow "  bun not found — installing from https://bun.sh …"
  curl -fsSL https://bun.sh/install | bash
  export PATH="${BUN_INSTALL:-$HOME/.bun}/bin:$PATH"
fi
need bun "install bun: https://bun.sh/ (then reopen your shell)"
green "  bun $(bun --version) ✓"

cyan "→ Cloning workspace…"
if [ -d "$INSTALL_DIR/.git" ]; then
  yellow "  $INSTALL_DIR exists; pulling latest"
  git -C "$INSTALL_DIR" pull --ff-only || yellow "  (pull skipped — local changes present)"
elif [ -e "$INSTALL_DIR" ]; then
  red "Path exists but is not a git repo: $INSTALL_DIR"; red "Move it or set INSTALL_DIR=…"; exit 1
else
  git clone "$REPO_URL" "$INSTALL_DIR"
fi
cd "$INSTALL_DIR"
green "  Workspace ready at $INSTALL_DIR ✓"

cyan "→ Generating .env.local (fresh secrets)…"
# config --yes is non-interactive: keeps an existing password/secrets, fills any
# gaps with strong defaults. Run `vps-cr config` later to set your own password.
node scripts/local/control.mjs config --yes --no-install
green "  .env.local ready ✓"

cyan "→ Installing deps (frontend + agent)…"
bun install --cwd frontend --silent
bun install --cwd agent --silent
green "  deps installed ✓"

cyan "→ Linking the vps-cr command…"
BIN_DIR="$HOME/.local/bin"
mkdir -p "$BIN_DIR"
ln -sf "$INSTALL_DIR/bin/vps-cr" "$BIN_DIR/vps-cr"
chmod +x "$INSTALL_DIR/bin/vps-cr"
green "  linked $BIN_DIR/vps-cr ✓"
case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) yellow "  NOTE: add $BIN_DIR to your PATH (add to ~/.bashrc or ~/.zshrc):"
     yellow "        export PATH=\"\$HOME/.local/bin:\$PATH\"" ;;
esac

bold ""
bold "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
green "  Install complete!"
bold "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat <<EOF

Next steps:

  1) Set your login password (optional, recommended):
       vps-cr config

  2) Start it (opens your browser when ready):
       vps-cr

  3) Log in with the password from step 1 — this machine is auto-trusted
     locally, so there's nothing else to approve.

  Useful: ${bold:-}vps-cr doctor${reset:-}  ·  vps-cr status  ·  vps-cr stop  ·  vps-cr help

EOF
cyan "Happy building. 🚀"
