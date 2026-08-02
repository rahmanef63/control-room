# Browser CRUD agent (Phase 3)

> **Optional, advanced.** This feature proxies to a paired **os-vps** deployment
> that runs the actual headless browser; control-room ships no browser runtime of
> its own. It is inert until you set `OS_VPS_URL` + `OS_AGENT_TOKEN` in
> `.env.local`. Once set, the browser routes are served by the agent at
> `:4001/browser/*`.

The agent can drive a real browser to operate any webapp through its UI — open,
navigate, click, fill, submit, read, verify — **without** an app-specific API.

## How it's wired (and why it's safe)

```
control-room agent ──x-os-agent-token──> os-vps /api/v1/browser/* ──> os-browser (Playwright)
```

The agent calls **os-vps**, which verifies the token, audits the action, then
forwards to the loopback runtime. The agent **never** holds `OS_BROWSER_SECRET`
and **never** talks to the runtime port (`:4002`) directly. os-vps is the single
auth boundary in front of the browser.

## Setup

In control-room `.env.local`:

```
OS_VPS_URL=https://<your-os-vps-host>
OS_AGENT_TOKEN=<same value as OS_AGENT_TOKEN in os-vps .env.local, >=16 chars>
```

Browser tools are inert (`501`) until both are set.

## Code

- `agent/src/browser/client.ts` — `BrowserClient`: navigate, click, clickSelector,
  fill, type, key, scroll, reload, state, content, elements, screenshot, plus
  `assertText` / `findByText` helpers.
- `agent/src/browser/crud.ts` — `runCrudFlow(steps)`: a replayable, logged CRUD
  flow. Stops at the first failed step; recovers a stale click by re-scanning
  `/elements` and retrying by visible text (`orText`).
- `agent/src/browser/http.ts` — gateway routes `GET /browser/{state,elements,
  content}`, `POST /browser/{navigate,crud}` (all gateway-authed).

## Run the CRUD flow

```bash
curl -s -X POST http://127.0.0.1:4001/browser/crud \
  -H "x-control-room-secret: $AGENT_GATEWAY_SECRET" \
  -H 'content-type: application/json' \
  -d '{"steps":[
    {"do":"navigate","url":"https://app.example.com/items"},
    {"do":"clickSelector","selector":"button[data-testid=\"new\"]","orText":"New"},
    {"do":"fill","selector":"input[name=\"title\"]","value":"Hello"},
    {"do":"clickSelector","selector":"button[type=\"submit\"]","orText":"Save"},
    {"do":"assertText","text":"Hello"},
    {"do":"clickSelector","selector":"button[data-testid=\"delete\"]","orText":"Delete"},
    {"do":"assertText","text":"Hello","expect":false}
  ]}'
```

## Eval

`agent/src/browser/client.test.ts` (run via `npm test` in `agent/`): unit tests
the request shaping (correct os-vps route, token header, no secret leak) and the
flow control. A live create→read→update→delete smoke test runs only when
`BROWSER_CRUD_TARGET` + `OS_AGENT_TOKEN` are set.
