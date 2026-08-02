import type http from "http";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

import {
  readJsonBody,
  readRawBody,
  requireGatewayAuth,
  sendJson,
} from "../../app/http-json.js";
import { terminalManager } from "../manager.js";
import { TERMINAL_PROFILES } from "../profiles.js";
import {
  listEnvironmentSummaries,
  listResolvedAgentProfiles,
} from "../../../../packages/runtime-config/index.js";

interface ResizeBody {
  cols?: number;
  rows?: number;
}

interface CreateBody {
  profile?: string;
  environmentId?: string;
  agentProfileId?: string;
  dangerouslyAllow?: boolean;
  useActiveDir?: boolean;
  cwd?: string;
}

interface InputBody {
  data?: string;
}

interface RenameBody {
  title?: string;
}

type TerminalAction = "input" | "resize" | "buffer" | "upload";

function parseTerminalPath(pathname: string): {
  sessionId?: string;
  action?: TerminalAction;
} | null {
  if (pathname === "/terminals") {
    return {};
  }

  const match = pathname.match(
    /^\/terminals\/([^/]+)(?:\/(input|resize|buffer|upload))?$/
  );
  if (!match) {
    return null;
  }

  return {
    sessionId: decodeURIComponent(match[1]),
    action: match[2] as TerminalAction | undefined,
  };
}

// Strips path separators / leading dots so an uploaded filename can never
// escape the per-session upload dir. Falls back to a generic name.
function sanitizeUploadName(raw: string): string {
  const base = path.basename(raw).replace(/[^\w.\- ]+/g, "_").replace(/^\.+/, "");
  const trimmed = base.trim().slice(0, 200);
  return trimmed.length > 0 ? trimmed : "upload.bin";
}

// Turn a free-form pane title into one safe path segment (no separators, no
// dot-traversal). Spaces collapse to dashes so the dir is shell-friendly.
export function sanitizeDirSegment(raw: string): string {
  const base = path
    .basename(raw)
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/^\.+/, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return base.length > 0 ? base : "terminal";
}

// Upload dir is named by the pane's created date + title (+ short id for
// uniqueness) so dropped files are findable, e.g. ~/.os/uploads/2026-06-23_animation_f7c1e726/.
// Date is UTC (host agent has no user TZ); id keeps same-title/same-day panes apart.
export function uploadDirFor(session: { id: string; title: string; created_at: number }): string {
  const date = new Date(session.created_at).toISOString().slice(0, 10);
  const title = sanitizeDirSegment(session.title);
  const sid = path.basename(session.id).slice(0, 8);
  return path.join(os.homedir(), ".os", "uploads", `${date}_${title}_${sid}`);
}

export async function handleTerminalHttpRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string
): Promise<boolean> {
  const parsed = parseTerminalPath(pathname);
  if (!parsed) {
    return false;
  }

  if (!requireGatewayAuth(req, res)) return true;

  try {
    if (pathname === "/terminals" && req.method === "GET") {
      sendJson(res, 200, {
        profiles: TERMINAL_PROFILES,
        sessions: terminalManager.listSessions(),
        environments: listEnvironmentSummaries(),
        agentProfiles: listResolvedAgentProfiles(),
      });
      return true;
    }

    if (pathname === "/terminals" && req.method === "POST") {
      const body = (await readJsonBody(req)) as CreateBody;
      if (
        typeof body.profile !== "string" &&
        typeof body.agentProfileId !== "string"
      ) {
        sendJson(res, 400, { error: "profile or agentProfileId is required" });
        return true;
      }

      const session = terminalManager.createSession({
        profile: typeof body.profile === "string" ? (body.profile as any) : undefined,
        environmentId:
          typeof body.environmentId === "string" ? body.environmentId : undefined,
        agentProfileId:
          typeof body.agentProfileId === "string" ? body.agentProfileId : undefined,
        dangerouslyAllow: body.dangerouslyAllow === true,
        useActiveDir: body.useActiveDir === true,
        cwd: typeof body.cwd === "string" ? body.cwd : undefined,
      });
      sendJson(res, 201, { session });
      return true;
    }

    if (!parsed.sessionId) {
      sendJson(res, 404, { error: "Not found" });
      return true;
    }

    if (!parsed.action && req.method === "GET") {
      sendJson(res, 200, { session: terminalManager.getSession(parsed.sessionId) });
      return true;
    }

    if (!parsed.action && req.method === "DELETE") {
      terminalManager.closeSession(parsed.sessionId);
      res.writeHead(204);
      res.end();
      return true;
    }

    if (!parsed.action && req.method === "PATCH") {
      const body = (await readJsonBody(req)) as RenameBody;
      if (typeof body.title !== "string") {
        sendJson(res, 400, { error: "title must be a string" });
        return true;
      }
      const session = terminalManager.renameSession(parsed.sessionId, body.title);
      sendJson(res, 200, { session });
      return true;
    }

    if (parsed.action === "input" && req.method === "POST") {
      const body = (await readJsonBody(req)) as InputBody;
      if (typeof body.data !== "string") {
        sendJson(res, 400, { error: "Input data must be a string" });
        return true;
      }
      terminalManager.sendInput(parsed.sessionId, body.data);
      sendJson(res, 200, { ok: true });
      return true;
    }

    if (parsed.action === "upload" && req.method === "POST") {
      // Reject unknown sessions so uploads can't create stray dirs.
      const record = terminalManager.peekSession(parsed.sessionId);
      if (!record) {
        sendJson(res, 404, { error: "Unknown session" });
        return true;
      }
      const url = new URL(req.url ?? "/", "http://internal");
      const rawName = url.searchParams.get("name") ?? "upload.bin";
      const name = sanitizeUploadName(rawName);
      const dir = uploadDirFor(record);
      const body = await readRawBody(req);
      if (body.length === 0) {
        sendJson(res, 400, { error: "Empty upload" });
        return true;
      }
      await fs.mkdir(dir, { recursive: true });
      // Avoid clobbering an existing file with the same name.
      let dest = path.join(dir, name);
      try {
        await fs.access(dest);
        const ext = path.extname(name);
        const stem = name.slice(0, name.length - ext.length);
        dest = path.join(dir, `${stem}-${body.length}${ext}`);
      } catch {
        // no collision
      }
      await fs.writeFile(dest, body, { mode: 0o600 });
      sendJson(res, 201, { path: dest, bytes: body.length });
      return true;
    }

    if (parsed.action === "buffer" && req.method === "GET") {
      const url = new URL(req.url ?? "/", "http://internal");
      const linesParam = url.searchParams.get("lines");
      const lines = linesParam ? Math.max(1, Math.min(2000, Number(linesParam) || 200)) : 200;
      const result = terminalManager.getBuffer(parsed.sessionId, lines);
      sendJson(res, 200, { sessionId: parsed.sessionId, lines: result.lines });
      return true;
    }

    if (parsed.action === "resize" && req.method === "POST") {
      const body = (await readJsonBody(req)) as ResizeBody;
      if (typeof body.cols !== "number" || typeof body.rows !== "number") {
        sendJson(res, 400, { error: "cols and rows must be numbers" });
        return true;
      }
      const session = terminalManager.resize(parsed.sessionId, body.cols, body.rows);
      sendJson(res, 200, { session });
      return true;
    }

    sendJson(res, 405, { error: "Method not allowed" });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terminal gateway error";
    sendJson(res, 400, { error: message });
    return true;
  }
}
