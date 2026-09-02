---
type: "task"
status: "confirmed"
confidence: "high"
created_at: "2026-09-02T18:11:15.538Z"
updated_at: "2026-09-02T18:11:15.538Z"
last_verified: null
scope: "repository"
tags: ["terminal", "cleanup", "standalone", "memory", "evidence"]
commit: "5915cdb797b844aaa2975e1ed390af8592025bd1"
supersedes: null
superseded_by: null
source: "agent"
---

# Return Control Room to tmux-like core

## Task

Remove product-scope expansion while keeping the standalone rule and developer-only evidence, memory, recipe, and Playwright improvements.

## Scope

Repository product architecture, privileged agent routes, frontend topbar/overlays, terminal pane wiring, active docs/agent instructions, E2E fixtures, and QA baseline.

## Result

Control Room is again terminal-first: persistent PTYs, panes, workspaces, mobile controls, history/templates, cwd/file helpers, broadcast input, lightweight overview, CLI launch profiles, and thin activity decoration. Provider/credential management, browser automation, scheduled jobs, supervisory orchestration, managed-app lifecycle, generic host exec, and obsolete supporting docs/presets were removed.

## Affected files

Main areas: `agent/src/app/`, `agent/src/terminal/`, `frontend/src/routes/+page.svelte`, `frontend/src/lib/features/terminals/`, `frontend/e2e/`, `README.md`, `PRD.md`, `CLAUDE.md`, `AGENTS.md`, `SECURITY.md`, and supporting docs.

## Verification

`bun run verify` passed, stale-scope and dead-path scans passed, `git diff --check` passed, and desktop/mobile terminal workspace screenshots were captured privately.

## Remaining issue

This checkpoint was not deployed to production. Real iOS Safari/PWA and Android Chrome/PWA testing is still recommended before a major mobile release because desktop viewport emulation cannot fully reproduce vendor keyboards and safe-area behavior.
