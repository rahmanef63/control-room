# VPS Control Room — Gemini Project Instructions

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
- **Deploy**: Dokploy + Traefik
- **Auth**: HMAC-SHA256 signed cookie (single-user)

## Key Rules

- Frontend NEVER executes host commands — goes through Convex command queue → agent executor
- Every Convex table MUST have indexes in schema.ts
- Every collector MUST be wrapped in try/catch
- Every action MUST go through allowlist validation
- NEVER put secrets in `NEXT_PUBLIC_*` vars

## Building & Running

```bash
cd frontend && npm install && npm run build   # Frontend
cd agent && npm install && npm run build      # Agent
bash scripts/deploy.sh                        # Full deploy
```

## YOLO Mode

Gemini YOLO mode auto-approves all tool calls:
```bash
gemini --yolo      # or: gemini -y  or: gemini --approval-mode=yolo
# Ctrl+Y toggles YOLO on/off mid-session
```

## Deploying New Projects (si-coder)

```bash
cd ~/projects/<app-name>
node ~/projects/vps-rahmanef/skills/si-coder/scripts/deploy.js \
  "$DOKPLOY_API_URL" "$DOKPLOY_API_KEY" \
  "<project>" "<app-name>" "$GITHUB_TOKEN" "<domain>"
```

Full si-coder docs: `skills/si-coder/SKILL.md`

## Agents Available (in .gemini/agents/)

- `si-coder` — Zero-human full-stack deploy to Dokploy
