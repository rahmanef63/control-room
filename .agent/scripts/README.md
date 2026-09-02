# Automation entry points

Executable scripts are centralized in `scripts/engineering/` so the repository has one script SSOT. This directory exists as part of the agent-memory layout and points agents to those stable entry points.

- `memory.mjs` — create/query/supersede/verify memory.
- `recipe.mjs` — observe and promote repeated workflows.
- `evidence.mjs` — create evidence receipts and scan memory/evidence for secret-like material.
- `verify-ui.mjs` — deterministic UI verification pipeline with optional receipt generation.
