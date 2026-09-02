---
type: "decision"
status: "confirmed"
confidence: "high"
created_at: "2026-09-02T18:11:15.414Z"
updated_at: "2026-09-02T18:16:09.280Z"
last_verified: "2026-09-02T18:16:09.280Z"
scope: "product-architecture"
tags: ["terminal", "tmux", "scope", "standalone"]
commit: "bdad906040aa6c4ebca2b605a89fd71201502634"
supersedes: null
superseded_by: null
source: "agent"
---

# Keep Control Room terminal-first

## Decision

Control Room is a browser/mobile alternative to tmux. User-facing features must directly improve creating, organizing, reconnecting to, or interacting with terminal sessions.

## Context

An earlier isolated branch made Control Room standalone by moving unrelated integration responsibilities into this repository. That solved cross-project dependency, but expanded the product into provider/account credential management, browser automation, scheduled-job UI, supervisory terminal orchestration, managed-application lifecycle, and generic host execution. The product intent was clarified as a simpler terminal multiplexer.

## Rationale

Authentication, deployment logic, browser work, provider accounts, and orchestration belong to the CLI/tool running inside a PTY. Making Control Room own those domains duplicates domain logic, enlarges the runtime and security surface, increases state/config/docs, and weakens the simple tmux-like mental model.

## Consequences

Keep PTY sessions, workspaces, mobile terminal UX, terminal history/templates, cwd/file helpers, broadcast input, lightweight host context, CLI launch profiles, and thin activity decoration. Exclude provider/credential management, browser automation, schedulers, supervisory orchestration, managed-app platforms, and project-specific runtime dependencies. `.agent/` memory/evidence remains developer-only infrastructure.

## Verification / review trigger

Review this boundary only if the product definition is explicitly changed. Commit `bdad906040aa6c4ebca2b605a89fd71201502634` passed the full repository verification and stale-scope/dead-path scans.
