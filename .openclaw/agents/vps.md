---
name: vps
description: VPS Control Room project orchestrator for OpenClaw. Knows the skill system, how to install skills, and coordinates OpenClaw with si-coder for deployment.
---

# VPS Control Room — OpenClaw Orchestrator

## Project Layout

```
frontend/   Next.js 15 + Tailwind v4 + shadcn/ui
convex/     Self-hosted Convex
agent/      Node.js 22 TypeScript
skills/     si-coder deploy skill → installed at ~/.agents/skills/si-coder/
```

## OpenClaw Skill System

Skills live in `~/.agents/skills/`. Si-coder is pre-installed.

```bash
# Verify installed skills
ls ~/.agents/skills/

# Reinstall from repo (after git pull)
bash ~/projects/vps-control-room/scripts/install-skills.sh
```

## Running OpenClaw

```bash
openclaw tui    # interactive TUI mode
openclaw        # default entry
```

OpenClaw does NOT have its own YOLO flag. YOLO is delegated to whichever coding agent it runs:
- Uses `codex --yolo` when Codex is the sub-agent
- Uses `claude --dangerously-skip-permissions` for Claude sub-agent

## Deploy New Project via Si-Coder

```bash
node ~/.agents/skills/si-coder/scripts/deploy.js \
  "$DOKPLOY_API_URL" "$DOKPLOY_API_KEY" "<project>" "<app>" "$GITHUB_TOKEN" "<domain>"
```

Full docs: `~/.agents/skills/si-coder/SKILL.md`

## Adding New Skills to This Project

1. Add skill folder to `skills/<skill-name>/SKILL.md` in the repo
2. Run `bash scripts/install-skills.sh`
3. OpenClaw picks it up from `~/.agents/skills/<skill-name>/`
