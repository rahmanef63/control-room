# Repository-local engineering memory

This directory is the human-readable, git-diffable engineering memory for Control Room. It records what was tried, what was verified, and why decisions were made without requiring a chat transcript or any other repository.

- `memory/` — task, debug, test, decision, and failure records.
- `recipes/` — repeated workflows that may be promoted to deterministic scripts.
- `evidence/receipts/` — structured verification receipts.
- `evidence/artifacts/` — local/private screenshots or traces; generated files are ignored by Git.
- `scripts/` — notes about automation entry points. Executable SSOT lives in `scripts/engineering/`.

Canonical records must never contain tokens, passwords, cookies, API keys, private keys, or raw credential values. Run `bun run evidence:check` before committing.
