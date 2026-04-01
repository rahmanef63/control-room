# VPS Control Room — Codex Project Instructions

This is a self-hosted VPS management dashboard. Read this file before starting any task.

## Project Structure

```
frontend/   Next.js 15 App Router + Tailwind + shadcn/ui
convex/     Self-hosted Convex (realtime sync, command queue, audit log)
agent/      Node.js 22 host agent (collectors, executor, systemd)
skills/     Shared deployment skills (si-coder)
```

## Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind v4, shadcn/ui, Radix UI
- **Backend**: Self-hosted Convex, Node.js 22
- **Deploy**: Dokploy + Traefik + GitHub Actions
- **Auth**: HMAC-SHA256 signed cookie (single-user)

## Key Rules

- Frontend NEVER executes host commands — goes through Convex command queue → agent executor
- Every Convex table MUST have indexes in schema.ts
- Every collector MUST be wrapped in try/catch (one failure must not stop others)
- Every action MUST go through allowlist validation
- NEVER put secrets in `NEXT_PUBLIC_*` vars

## Building & Running

```bash
# Frontend
cd frontend && npm install && npm run build

# Agent
cd agent && npm install && npm run build

# Deploy (from VPS)
bash scripts/deploy.sh
```

## Deploying New Projects (si-coder)

Use the si-coder skill to deploy any full-stack project from scratch:

```bash
# Ensure env vars are set
echo $DOKPLOY_API_URL && echo $DOKPLOY_API_KEY && echo $GITHUB_TOKEN

# Run deploy
cd ~/projects/<app-name>
node ~/projects/vps-rahmanef/skills/si-coder/scripts/deploy.js \
  "$DOKPLOY_API_URL" "$DOKPLOY_API_KEY" \
  "<project>" "<app-name>" "$GITHUB_TOKEN" "<domain>"
```

Full si-coder documentation: `skills/si-coder/SKILL.md`
Requirements and setup: `docs/si-coder-requirements.md`

## Agents Available (in .codex/agents/)

- `si-coder` — Zero-human full-stack deploy to Dokploy
