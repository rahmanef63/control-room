---
name: si-coder
description: Zero-human full-stack deployment skill for OpenClaw. Reads ~/.agents/skills/si-coder/SKILL.md for the complete workflow. Builds Next.js + Convex from scratch, pushes to GitHub, configures Dokploy, sets up DNS, and deploys schema automatically.
---

# SI Coder — OpenClaw Skill Reference

This agent wraps the si-coder skill installed at `~/.agents/skills/si-coder/`.

## Quick Deploy

```bash
cd ~/projects/<app-name>
node ~/.agents/skills/si-coder/scripts/deploy.js \
  "$DOKPLOY_API_URL" \
  "$DOKPLOY_API_KEY" \
  "<project-name>" \
  "<app-name>" \
  "$GITHUB_TOKEN" \
  "<domain.com>"
```

## Full Skill Docs

```bash
cat ~/.agents/skills/si-coder/SKILL.md
```

## If Skill Not Found

```bash
bash ~/projects/vps-rahmanef/scripts/install-skills.sh
```

## Required Env Vars

```bash
DOKPLOY_API_URL      Your Dokploy server URL
DOKPLOY_API_KEY      Dokploy API key (Settings → API Keys)
GITHUB_TOKEN         GitHub PAT with repo + admin scope
HOSTINGER_API_TOKEN  Optional — auto DNS setup
```
