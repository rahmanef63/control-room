# VPS Control Room — Agent Instructions

The single source of truth for every coding agent (Claude, Codex, Gemini) is
**[CLAUDE.md](./CLAUDE.md)** in the repo root. Read it before starting any task.

This file is an intentional pointer — three near-identical instruction copies
were collapsed into one to avoid drift. Runtime is HTTP-only
(frontend → agent HTTP API → host); there is no Convex layer on the hot path.
