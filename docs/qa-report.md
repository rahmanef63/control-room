# Control Room QA Baseline — Svelte Canonical Runtime

**Audit date:** 2 September 2026
**Target:** SvelteKit 2 / Svelte 5 production candidate
**Status:** Automated baseline active

## Automated acceptance matrix

The repository now blocks release on an isolated Playwright suite backed by a
stub agent, so layout/auth/accessibility regressions do not require or mutate the
production agent.

| Gate | Coverage | Current baseline |
|---|---|---:|
| Responsive overflow | 320×568, 360×800, 390×844, 430×932, 768×1024, 1366×768, 844×390 landscape | PASS |
| Accessibility | Axe WCAG 2 A/AA + 2.1 AA; zero critical/serious violations on login and authenticated app shell | PASS |
| Visual regression | 390×844 login baseline | PASS |
| Svelte diagnostics | `svelte-check` | 0 errors / 0 warnings |
| Frontend unit coverage | overall lines ≥90%, functions ≥85% | 94.08% / 92.29% |
| Agent unit coverage | overall lines ≥45%, functions ≥40% | 48.92% / 45.68% |
| Dependency audit | frontend + agent | 0 known vulnerabilities at this baseline |

The first run of the new suite exposed a real ARIA defect: a non-tab “New
workspace” button was inside a `tablist`. The workspace selector is now a
semantic toolbar with pressed-state workspace buttons. The suite also exposed
that repeatedly logging in during a viewport matrix trips the intentional login
rate limiter; the matrix now authenticates once and resizes the same browser
session.

## Production-only smoke

The isolated suite cannot prove PTY or host integration. Every deployment that
touches the terminal bridge or agent must additionally verify against the
running production pair:

- approved-device login;
- terminal create → input → resize → buffer → SSE output → close;
- frontend SSE to server-side WebSocket bridge using the machine gateway secret;
- Browser CRUD and log proxy endpoints;
- public HTTPS login/health and unauthenticated API protection;
- CSP/HSTS/security headers;
- agent bound only to `127.0.0.1:4001` and absent from Traefik;
- runtime state/auth approvals preserved across release switching.

## Remaining real-device checks

Automated desktop Chrome viewport emulation does not fully reproduce iOS
VisualViewport/keyboard/notch behavior or Android vendor keyboards. Before a
major mobile layout release, verify at least one real iOS Safari/PWA and one real
Android Chrome/PWA session with the soft keyboard open, fullscreen toggled, and
portrait/landscape rotation.
