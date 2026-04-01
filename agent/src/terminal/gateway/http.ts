import type http from "http";

import { config } from "../../config.js";
import { isAuthorizedGatewayRequest } from "../auth.js";
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
}

interface InputBody {
  data?: string;
}

type JsonBody = CreateBody | ResizeBody | InputBody;

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function parseTerminalPath(pathname: string): {
  sessionId?: string;
  action?: "input" | "resize";
} | null {
  if (pathname === "/terminals") {
    return {};
  }

  const match = pathname.match(/^\/terminals\/([^/]+)(?:\/(input|resize))?$/);
  if (!match) {
    return null;
  }

  return {
    sessionId: decodeURIComponent(match[1]),
    action: match[2] as "input" | "resize" | undefined,
  };
}

function readJsonBody(req: http.IncomingMessage): Promise<JsonBody> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on("data", (chunk) => {
      chunks.push(Buffer.from(chunk));
    });

    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as JsonBody);
      } catch (error) {
        reject(error);
      }
    });

    req.on("error", reject);
  });
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

  if (!isAuthorizedGatewayRequest(req, config.CONTROL_ROOM_SECRET)) {
    sendJson(res, 401, { error: "Unauthorized terminal gateway request" });
    return true;
  }

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
