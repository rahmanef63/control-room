import type http from "http";

import { readJsonBody, requireGatewayAuth, sendJson } from "../app/http-json.js";
import { ManagedAppRateLimiter, assertManagedAppsWritable, requestRateLimitKey } from "./guard.js";
import { managedAppRegistry } from "./registry.js";
import { safeManagedAppError } from "./security.js";

const actionRateLimiter = new ManagedAppRateLimiter();

function parsePath(pathname: string): { id?: string; resource?: "logs" | "actions" } | null {
  if (pathname === "/managed-apps") return {};
  const match = pathname.match(/^\/managed-apps\/([^/]+)(?:\/(logs|actions))?$/);
  return match ? { id: decodeURIComponent(match[1]), resource: match[2] as "logs" | "actions" | undefined } : null;
}

export async function handleManagedAppsHttpRequest(req: http.IncomingMessage, res: http.ServerResponse, pathname: string): Promise<boolean> {
  const parsed = parsePath(pathname);
  if (!parsed) return false;
  if (!requireGatewayAuth(req, res)) return true;
  try {
    if (!parsed.id && req.method === "GET") { sendJson(res, 200, { apps: await managedAppRegistry.list() }); return true; }
    if (!parsed.id) { sendJson(res, 405, { error: "Method not allowed" }); return true; }
    if (!parsed.resource && req.method === "GET") { sendJson(res, 200, { app: await managedAppRegistry.get(parsed.id) }); return true; }
    if (parsed.resource === "logs" && req.method === "GET") { sendJson(res, 200, await managedAppRegistry.logs(parsed.id)); return true; }
    if (parsed.resource === "actions" && req.method === "POST") {
      assertManagedAppsWritable();
      actionRateLimiter.consume(requestRateLimitKey(req.socket.remoteAddress));
      const body = await readJsonBody<{ action?: unknown; preserveData?: unknown }>(req);
      const output = await managedAppRegistry.act(parsed.id, body.action, body.preserveData);
      sendJson(res, 200, output);
      return true;
    }
    sendJson(res, 405, { error: "Method not allowed" });
    return true;
  } catch (error) {
    const safe = safeManagedAppError(error);
    sendJson(res, safe.status, { error: safe.error });
    return true;
  }
}
