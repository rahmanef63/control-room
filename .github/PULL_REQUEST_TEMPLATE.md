<!--
Thanks for the PR! Fill in the sections below. Empty PRs will be closed.
See CONTRIBUTING.md for the full contribution guide.
-->

## Why

<!-- The motivation. What problem does this solve? Link the issue. -->

Closes #

## What changed

<!-- High-level summary. The diff shows the details. -->

-
-
-

## Screenshots / recordings

<!-- Required for any UI change. Before + after. Drag-and-drop to attach. -->

| Before | After |
|--------|-------|
|        |       |

## How to test

<!-- Reproducible steps a reviewer can run locally. -->

1.
2.
3.

## Checklist

- [ ] Branched from latest `main`
- [ ] Conventional commit message (`type(scope): subject`)
- [ ] `bun run --cwd frontend typecheck` passes
- [ ] `bun run --cwd agent test:all` passes (typecheck + tests)
- [ ] No new `console.log` left behind
- [ ] No secrets, IPs, or PII in the diff or commit message
- [ ] No new runtime dependency (or justified in "Why" above)
- [ ] Docs updated if behavior changed (`README.md`, `docs/`)

## Security / threat-model impact

<!--
"None" is a valid answer. If you touched auth, the executor allowlist,
the WebSocket handler, or env loading, explain the impact.
-->

None.
