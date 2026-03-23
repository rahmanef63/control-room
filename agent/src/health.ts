import http from "http";
import { URL } from "url";

import WebSocket, { WebSocketServer, type RawData } from "ws";

import { config } from "./config.js";
import { isConvexConnected } from "./convex-client.js";
import { logger } from "./logger.js";
import { listEnvironmentSummaries, listResolvedAgentProfiles } from "./runtime-config.js";
import { isAuthorizedGatewayRequest, isAuthorizedTerminalSocket } from "./terminal/auth.js";
import { terminalManager } from "./terminal/manager.js";
import { TERMINAL_PROFILES } from "./terminal/profiles.js";

let server: http.Server | null = null;
let wsServer: WebSocketServer | null = null;
let lastSnapshot: number | null = null;

interface TerminalUpgradeRequest extends http.IncomingMessage {
  terminalSessionId?: string;
}

interface ResizeBody {
  cols?: number;
  rows?: number;
}

interface CreateBody {
  profile?: string;
  environmentId?: string;
  agentProfileId?: string;
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

async function handleTerminalHttpRequest(
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

function handleWebSocketConnection(raw: RawData): {
  type?: string;
  data?: string;
  cols?: number;
  rows?: number;
} | null {
  try {
    return JSON.parse(raw.toString("utf8")) as {
      type?: string;
      data?: string;
      cols?: number;
      rows?: number;
    };
  } catch {
    return null;
  }
}

export function updateLastSnapshot(ts: number): void {
  lastSnapshot = ts;
}

export function startHealthServer(): void {
  wsServer = new WebSocketServer({ noServer: true });

  server = http.createServer(async (req, res) => {
    if (!req.url) {
      res.writeHead(400);
      res.end("Missing URL");
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host ?? "127.0.0.1"}`);

    if (req.method === "GET" && url.pathname === "/health") {
      const body = JSON.stringify({
        status: "ok",
        uptime: process.uptime(),
        convex_connected: isConvexConnected(),
        last_snapshot: lastSnapshot,
        terminal_sessions: terminalManager.listSessions().length,
      });

      res.writeHead(200, {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      });
      res.end(body);
      return;
    }

    if (await handleTerminalHttpRequest(req, res, url.pathname)) {
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  });

  server.on("upgrade", (req, socket, head) => {
    try {
      if (!req.url || !wsServer) {
        socket.destroy();
        return;
      }

      const url = new URL(req.url, `http://${req.headers.host ?? "127.0.0.1"}`);
      if (url.pathname !== "/ws/terminals") {
        socket.destroy();
        return;
      }

      if (!isAuthorizedTerminalSocket(req, config.CONTROL_ROOM_SESSION_SECRET)) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      const sessionId = url.searchParams.get("sessionId");
      if (!sessionId) {
        socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
        socket.destroy();
        return;
      }

      const upgradeReq = req as TerminalUpgradeRequest;
      upgradeReq.terminalSessionId = sessionId;

      wsServer.handleUpgrade(upgradeReq, socket, head, (ws) => {
        wsServer?.emit("connection", ws, upgradeReq);
      });
    } catch (error) {
      logger.error("Terminal socket upgrade error", { error: String(error) });
      socket.destroy();
    }
  });

  wsServer.on("connection", (ws, req) => {
    const sessionId = (req as TerminalUpgradeRequest).terminalSessionId;
    if (!sessionId) {
      ws.close(4404, "Session not found");
      return;
    }

    let unsubscribe: (() => void) | null = null;

    try {
      unsubscribe = terminalManager.subscribe(sessionId, (event) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(event));
        }
      });
    } catch (error) {
      ws.send(
        JSON.stringify({
          type: "error",
          message: error instanceof Error ? error.message : "Terminal session not found",
        })
      );
      ws.close(4404, "Session not found");
      return;
    }

    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "pong", ts: Date.now() }));
      }
    }, 15000);

    ws.on("message", (raw) => {
      const payload = handleWebSocketConnection(raw);
      if (!payload?.type) {
        ws.send(JSON.stringify({ type: "error", message: "Invalid WebSocket payload" }));
        return;
      }

      try {
        if (payload.type === "input" && typeof payload.data === "string") {
          terminalManager.sendInput(sessionId, payload.data);
          return;
        }

        if (
          payload.type === "resize" &&
          typeof payload.cols === "number" &&
          typeof payload.rows === "number"
        ) {
          terminalManager.resize(sessionId, payload.cols, payload.rows);
          return;
        }

        if (payload.type === "close") {
          terminalManager.closeSession(sessionId);
          ws.close(1000, "Closed");
          return;
        }

        if (payload.type === "ping") {
          ws.send(JSON.stringify({ type: "pong", ts: Date.now() }));
          return;
        }

        ws.send(JSON.stringify({ type: "error", message: "Unsupported WebSocket message" }));
      } catch (error) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: error instanceof Error ? error.message : "Terminal gateway error",
          })
        );
      }
    });

    ws.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe?.();
    });

    ws.on("error", (error) => {
      logger.warn("Terminal socket error", {
        sessionId,
        error: String(error),
      });
      clearInterval(heartbeat);
      unsubscribe?.();
    });
  });

  server.on("error", (err) => {
    logger.error("Health server error", { error: String(err) });
  });

  server.listen(config.AGENT_HEALTH_PORT, "0.0.0.0", () => {
    logger.info("Health server listening", { port: config.AGENT_HEALTH_PORT });
  });
}

export function stopHealthServer(): void {
  wsServer?.clients.forEach((client) => client.close(1001, "Server shutting down"));
  wsServer?.close();
  wsServer = null;

  if (server) {
    server.close(() => {
      logger.info("Health server stopped");
    });
    server = null;
  }
}
