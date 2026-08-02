import type http from "http";

import { readJsonBody, requireGatewayAuth, sendJson } from "../app/http-json.js";
import { cronManager } from "./manager.js";
import type { CronCreateInput, CronUpdateInput } from "./types.js";

interface ParsedCronPath {
  id?: string;
  action?: "run";
}

function parseCronPath(pathname: string): ParsedCronPath | null {
  if (pathname === "/crons") return {};
  const match = pathname.match(/^\/crons\/([^/]+)(?:\/(run))?$/);
  if (!match) return null;
  return { id: decodeURIComponent(match[1]), action: match[2] as "run" | undefined };
}

export async function handleCronHttpRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string
): Promise<boolean> {
  const parsed = parseCronPath(pathname);
  if (!parsed) return false;

  if (!requireGatewayAuth(req, res)) return true;

  try {
    if (pathname === "/crons" && req.method === "GET") {
      sendJson(res, 200, { crons: cronManager.list() });
      return true;
    }

    if (pathname === "/crons" && req.method === "POST") {
      const body = (await readJsonBody(req)) as CronCreateInput;
      if (!body || typeof body.cronExpr !== "string" || !body.action) {
        sendJson(res, 400, { error: "cronExpr and action are required" });
        return true;
      }
      const created = cronManager.create(body);
      sendJson(res, 201, { cron: created });
      return true;
    }

    if (!parsed.id) {
      sendJson(res, 404, { error: "Not found" });
      return true;
    }

    if (!parsed.action && req.method === "GET") {
      const entry = cronManager.get(parsed.id);
      if (!entry) {
        sendJson(res, 404, { error: "Cron not found" });
        return true;
      }
      sendJson(res, 200, { cron: entry });
      return true;
    }

    if (!parsed.action && req.method === "PATCH") {
      const body = (await readJsonBody(req)) as CronUpdateInput;
      const updated = cronManager.update(parsed.id, body ?? {});
      sendJson(res, 200, { cron: updated });
      return true;
    }

    if (!parsed.action && req.method === "DELETE") {
      const deleted = cronManager.delete(parsed.id);
      if (!deleted) {
        sendJson(res, 404, { error: "Cron not found" });
        return true;
      }
      res.writeHead(204);
      res.end();
      return true;
    }

    if (parsed.action === "run" && req.method === "POST") {
      const entry = await cronManager.runNow(parsed.id);
      sendJson(res, 200, { cron: entry });
      return true;
    }

    sendJson(res, 405, { error: "Method not allowed" });
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cron error";
    sendJson(res, 400, { error: message });
    return true;
  }
}
