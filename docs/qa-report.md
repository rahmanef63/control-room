# Control Room QA Baseline — v2.0.0 Terminal Runtime

**Audit date:** 3 September 2026
**Target:** SvelteKit 2 / Svelte 5 terminal-first v2.0.0
**Status:** Automated baseline active; production not modified by this documentation audit

## Automated acceptance matrix

The release gate uses an isolated Playwright suite backed by a stub terminal agent,
so responsive/auth/accessibility/terminal-lifecycle regressions can be tested
without touching the production PTY agent.

| Gate | Coverage | Current baseline |
|---|---|---:|
| Documentation consistency | 38 tracked Markdown files; relative links; package-version sync; stale terminal-first residue markers | PASS |
| Responsive overflow | 320×568, 360×800, 390×844, 430×932, 768×1024, 1366×768, 1440×900, 1920×1080, 844×390 landscape | PASS |
| App-chrome density | desktop menu ≤32px, workspace ≤34px, command bar ≤40px, terminal stage >620px at 1366×768; mobile bars bounded independently | PASS |
| Accessibility | Axe WCAG 2 A/AA + 2.1 AA; zero critical/serious violations on login and authenticated app shell | PASS |
| Visual regression | 390×844 login baseline + terminal workspace evidence | PASS |
| Svelte diagnostics | `svelte-check` | 0 errors / 0 warnings |
| Frontend unit coverage | overall lines ≥90%, functions ≥85% | 93.84% / 92.36% |
| Agent unit coverage | overall lines ≥45%, functions ≥40% | 48.93% / 52.62% |
| Dependency audit | frontend + agent | 0 known vulnerabilities at the last full gate |

The browser suite treats terminal lifecycle as the product proof: create a shell,
verify pane controls, duplicate the session, then re-check desktop/mobile overflow
and accessibility. Playwright's production web server now runs the built SvelteKit
adapter-node output with **Node 22**, matching the production runtime instead of
using Bun as the application server.

Browser console/page errors, genuine request failures, and HTTP 5xx responses fail
the suite. Intentional navigation aborts remain diagnostics rather than false
outages.

## Production-only smoke

The isolated suite cannot prove real host PTY integration. Every deployment that
touches the terminal bridge or agent must additionally verify against the running
production pair:

- approved-device login;
- terminal create → duplicate → input → resize → buffer → SSE output → close;
- frontend SSE to server-side WebSocket bridge using the machine gateway secret;
- real process-tree teardown on terminal close;
- public HTTPS login/health and unauthenticated API protection;
- CSP/HSTS/security headers;
- agent bound only to `127.0.0.1:4001` and absent from the public Traefik route;
- runtime state/auth approvals preserved across release switching.

## Remaining real-device checks

Automated desktop Chromium viewport emulation does not fully reproduce iOS
VisualViewport/keyboard/notch behavior or Android vendor keyboards. Before a major
mobile layout release, verify at least one real iOS Safari/PWA and one real Android
Chrome/PWA session with the soft keyboard open, fullscreen toggled, and
portrait/landscape rotation.
