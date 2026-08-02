# Contributing to VPS Control Room

Thanks for considering a contribution! This project is a single-user,
self-hosted dashboard, so contribution scope is intentionally narrow:
**bug fixes, polish, and small features that fit a one-VPS owner.**

If you have a larger idea (multi-tenant, billing, public-internet exposure),
please open an issue first to discuss — chances are it belongs in a fork.

---

## Quick start (local dev, no VPS needed)

```bash
# 1. Fork on GitHub, then:
git clone git@github.com:<your-fork>/control-room.git
cd control-room

# 2. Local env (loopback secrets, no real VPS data)
cp .env.example .env.local
# edit CONTROL_ROOM_SECRET + CONTROL_ROOM_SESSION_SECRET to ANY 32+ char value

# 3. Install deps (per-component, no monorepo)
npm --prefix frontend install
npm --prefix agent install

# 4. Run two terminals
npm --prefix agent  run dev      # http://127.0.0.1:4001/health
npm --prefix frontend run dev    # http://127.0.0.1:4000

# 5. Login with the secret you set in step 2
```

No Docker, no Convex, no Tailscale needed for local dev. The agent
collectors that need host privileges (Docker socket, systemctl) just
return `null` or empty arrays — they don't crash.

---

## Project layout

```
frontend/    Next.js 15 App Router, Tailwind, shadcn/ui — the PWA
agent/       Node 22 host agent — pty gateway, host telemetry, log.json
scripts/     deploy.sh, install-systemd.sh, bump-version.sh
docs/        install, onboarding, runbook
ops/         traefik dynamic config templates
packages/    shared TS contracts + runtime config
```

Each top-level component has its own `package.json` and `tsconfig.json`.
Treat them as separate publishable units; **do not add cross-imports**
between `frontend/` and `agent/`. Share via `packages/contracts`.

---

## Branch + commit

- Branch from `main`: `feat/<slug>`, `fix/<slug>`, `docs/<slug>`,
  `chore/<slug>`.
- One feature per branch. No mixed bag PRs.
- Conventional commits (`type(scope): subject`). Example:
  - `fix(terminal): clamp grid row height to 2 rows on desktop`
  - `feat(skills): scan project markers up to git root`
  - `docs(readme): add quick-start section`
- Imperative mood. Explain **why**, not what. The diff already shows what.
- Sign-off optional, but include `Co-Authored-By:` if a tool helped.

---

## Code style

- **TypeScript strict** — no `any` without a `// reason:` comment.
- **ESLint** — `npm --prefix frontend run lint`. Don't disable rules
  globally; disable inline with reason.
- **Tailwind** — prefer utility classes over `style={{}}`. Use the
  shadcn/ui primitives from `frontend/src/components/ui/`.
- **No comments that restate the code.** Only comment hidden constraints,
  subtle invariants, or non-obvious workarounds.
- **No dead code.** Delete instead of commenting out.

---

## Testing

The current test target is **typecheck-only** — fast and catches most
regressions:

```bash
npm --prefix frontend run typecheck
npm --prefix agent     run build      # tsc -p tsconfig.json
```

If you add Jest/Vitest, place specs next to the source as
`*.test.ts(x)` and add a `test` script. Don't add coverage tooling
yet — the codebase is small.

**Manual smoke tests** for UI changes:
1. Login with the dev secret.
2. Spawn a terminal (`bash` profile).
3. Open settings drawer, toggle heartbeat-glow.
4. Resize browser between mobile/tablet/desktop breakpoints.
5. Verify no console errors.

---

## Security rules (non-negotiable)

- **Never commit secrets.** `.env.local` is gitignored — keep it that
  way. CI never reads from `process.env` directly; everything goes
  through `frontend/src/lib/env.ts` and `agent/src/env.ts`.
- **Never log secrets.** No `console.log(process.env)`.
- **Never add a new terminal profile** (`agent/src/terminal/profiles.ts`)
  without a paired issue explaining what it spawns and the worst case.
- **No `NEXT_PUBLIC_*`** for anything secret. Anything with that prefix
  ships to the browser.
- **No telemetry beacons** to third-party servers. Self-host only.

See [SECURITY.md](./SECURITY.md) for vulnerability reporting.

---

## Pull requests

1. Fill in the PR template fully. The "Why" matters more than "What".
2. Link the issue (`Closes #123`).
3. Screenshots for any UI change — before + after.
4. Keep diffs small. <400 lines preferred. Split a refactor from a
   feature.
5. **No force-push to a branch with review comments** unless you've
   addressed all of them and re-requested review.

CI runs typecheck on the self-hosted runner. Workflows are
`workflow_dispatch:` only — they don't trigger on push, by design.

---

## What we WILL merge

- Bug fixes with reproduction steps.
- UX polish for the mobile PWA path.
- Accessibility improvements (keyboard nav, ARIA, contrast).
- New agent host-action endpoints with clear safety rationale.
- Docs improvements.

## What we WON'T merge (without prior discussion)

- Multi-user / multi-tenant features.
- Anything that requires exposing the dashboard to the public internet.
- New runtime dependencies (npm packages) without a strong reason.
- Migrations away from npm to pnpm/yarn/bun.
- Telemetry, analytics, or "phone home" code.

---

## Code of conduct

Be kind. Assume the other person has more context than you can see.
Reviewers: critique the code, not the contributor. Contributors:
absorb feedback; if you disagree, explain why in the PR.

---

## License

By contributing, you agree your contributions are licensed under the
[MIT License](./LICENSE).
