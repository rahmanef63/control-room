import assert from "node:assert/strict";
import { test } from "node:test";

import { BrowserClient } from "./client.js";
import { runCrudFlow, type Step } from "./crud.js";

// Record outbound requests so we can assert the client hits os-vps's authed
// routes with the agent token — never the runtime secret or :4002 directly.
type Call = { url: string; init?: RequestInit };
function stubFetch(responder: (call: Call) => unknown): Call[] {
  const calls: Call[] = [];
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    const call = { url: String(url), init };
    calls.push(call);
    const body = responder(call);
    return {
      ok: true,
      status: 200,
      json: async () => body,
      arrayBuffer: async () => new ArrayBuffer(0),
    } as Response;
  }) as typeof fetch;
  return calls;
}

const client = new BrowserClient("https://os.example.com", "token-1234567890abcdef");

test("navigate posts to the os-vps route with the agent token", async () => {
  const calls = stubFetch(() => ({ url: "https://x", title: "X" }));
  await client.navigate("https://target.test");
  assert.equal(calls[0]!.url, "https://os.example.com/api/v1/browser/navigate");
  const headers = calls[0]!.init!.headers as Record<string, string>;
  assert.equal(headers["x-os-agent-token"], "token-1234567890abcdef");
  assert.ok(!JSON.stringify(calls[0]!.init).includes("os-browser-secret"), "must not leak runtime secret");
  assert.match(String(calls[0]!.init!.body), /target\.test/);
});

test("clickSelector maps to the /click-selector route", async () => {
  const calls = stubFetch(() => ({ url: "https://x", title: "X" }));
  await client.clickSelector("button[type=submit]");
  assert.equal(calls[0]!.url, "https://os.example.com/api/v1/browser/click-selector");
});

test("assertText reflects page content", async () => {
  stubFetch(() => ({ url: "u", title: "t", text: "Order #42 created" }));
  assert.equal(await client.assertText("Order #42"), true);
  assert.equal(await client.assertText("missing"), false);
});

test("runCrudFlow stops at the first failed step", async () => {
  // /content always returns a body WITHOUT the asserted text → assertText fails.
  stubFetch(() => ({ url: "u", title: "t", text: "empty list" }));
  const steps: Step[] = [
    { do: "navigate", url: "https://target.test" },
    { do: "assertText", text: "Created OK" }, // fails
    { do: "navigate", url: "https://never.test" }, // must not run
  ];
  const results = await runCrudFlow(steps, client);
  assert.equal(results.length, 2);
  assert.equal(results[0]!.ok, true);
  assert.equal(results[1]!.ok, false);
});

// Live CRUD smoke test — only runs when a real target + token are configured.
// Drives a full create→read→update→delete entirely through the browser UI.
const liveTarget = process.env["BROWSER_CRUD_TARGET"];
test(
  "live CRUD against a real target",
  { skip: !liveTarget || !process.env["OS_AGENT_TOKEN"] ? "set BROWSER_CRUD_TARGET + OS_AGENT_TOKEN" : false },
  async () => {
    const live = new BrowserClient();
    const r = await runCrudFlow([{ do: "navigate", url: liveTarget! }, { do: "wait", ms: 1000 }], live);
    assert.ok(r.every((x) => x.ok));
  },
);
