// HTTP gateway for browser-driving. Mirrors the cron/terminal handler shape:
// returns true once it owns the request. Every route is gateway-authed (same
// secret as the rest of the agent API) and delegates to BrowserClient, which in
// turn calls os-vps's authed + audited /api/v1/browser/* — so the agent never
// holds OS_BROWSER_SECRET and os-vps remains the single auth boundary.
import type http from "http";

import { requireGatewayAuth, sendJson, readJsonBody } from "../app/http-json.js";
import { BrowserClient, browserConfigured } from "./client.js";
import { runCrudFlow, type Step } from "./crud.js";

export async function handleBrowserHttpRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
): Promise<boolean> {
  if (!pathname.startsWith("/browser/")) return false;
  if (!requireGatewayAuth(req, res)) return true;

  if (!browserConfigured()) {
    sendJson(res, 501, { error: "browser not configured (set OS_VPS_URL + OS_AGENT_TOKEN)" });
    return true;
  }

  const client = new BrowserClient();
  try {
    if (req.method === "GET" && pathname === "/browser/state") {
      sendJson(res, 200, await client.state());
      return true;
    }
    if (req.method === "GET" && pathname === "/browser/elements") {
      sendJson(res, 200, await client.elements());
      return true;
    }
    if (req.method === "GET" && pathname === "/browser/content") {
      sendJson(res, 200, await client.content());
      return true;
    }
    if (req.method === "POST" && pathname === "/browser/navigate") {
      const { url } = await readJsonBody<{ url: string }>(req);
      sendJson(res, 200, await client.navigate(String(url ?? "")));
      return true;
    }
    if (req.method === "POST" && pathname === "/browser/crud") {
      const { steps } = await readJsonBody<{ steps: Step[] }>(req);
      const results = await runCrudFlow(Array.isArray(steps) ? steps : [], client);
      sendJson(res, 200, { ok: results.every((r) => r.ok), results });
      return true;
    }
    sendJson(res, 404, { error: "unknown browser route" });
    return true;
  } catch (e) {
    sendJson(res, 502, { error: String(e) });
    return true;
  }
}
