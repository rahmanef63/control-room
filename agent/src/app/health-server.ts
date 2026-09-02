import crypto from "crypto";
import http from "http";

import { WebSocketServer } from "ws";

import { config } from "../config.js";
import { logger } from "../logger.js";
import { TERMINAL_PROFILES } from "../terminal/profiles.js";
import { handleTerminalHttpRequest } from "../terminal/gateway/http.js";
import {
  handleTerminalSocketUpgrade,
  registerTerminalSocketServer,
} from "../terminal/gateway/socket.js";
import { terminalManager } from "../terminal/manager.js";
import { isAuthorizedGatewayRequest } from "../terminal/auth.js";
import { requireGatewayAuth, sendJson, sendError, readJsonBody } from "./http-json.js";
import { listDirectory } from "../fs/explorer.js";
import {
  readFileText,
  writeFileText,
  makeDir,
  removePath,
  movePath,
  copyPath,
  diskUsage,
} from "../fs/mutate.js";
import { listSkills } from "../fs/skills.js";
import { readJsonState, writeJsonState } from "../state/store.js";
import { cleanupLog, readLog, type LogLevel } from "../state/log.js";
import { getHostTelemetrySnapshot } from "./host-telemetry.js";
import {
  listEnvironmentSummaries,
  listResolvedAgentProfiles,
} from "../../../packages/runtime-config/index.js";

let server: http.Server | null = null;
let wsServer: WebSocketServer | null = null;

// Cap the per-message WS frame and per-request body so a single oversized
// payload can't OOM the daemon that owns all host control.
const MAX_WS_PAYLOAD_BYTES = 1_000_000;
const MAX_STATE_BODY_BYTES = 1_000_000;

function sendHealthResponse(req: http.IncomingMessage, res: http.ServerResponse): void {
  // Liveness is public; detailed host telemetry + runtime counts are sensitive
  // recon data, so only return them to authorized callers.
  const base = { status: "ok", uptime: process.uptime() };
  let payload: Record<string, unknown> = base;

  if (isAuthorizedGatewayRequest(req, config.GATEWAY_SECRET)) {
    const telemetry = getHostTelemetrySnapshot();
    payload = {
      ...base,
      last_snapshot: telemetry?.timestamp ?? null,
      runtime: {
        terminal_sessions: terminalManager.listSessions().length,
        terminal_profiles: TERMINAL_PROFILES.length,
        environments: listEnvironmentSummaries().length,
        agent_profiles: listResolvedAgentProfiles().length,
      },
      telemetry,
    };
  }

  sendJson(res, 200, payload);
}

export function startHealthServer(): void {
  wsServer = new WebSocketServer({ noServer: true, maxPayload: MAX_WS_PAYLOAD_BYTES });
  registerTerminalSocketServer(wsServer);

  server = http.createServer(async (req, res) => {
    const startedAt = performance.now();
    const inboundRequestId = req.headers["x-request-id"];
    const requestId =
      typeof inboundRequestId === "string" && inboundRequestId.length > 0
        ? inboundRequestId.slice(0, 128)
        : crypto.randomUUID();
    res.setHeader("X-Request-Id", requestId);
    res.on("finish", () => {
      const path = (req.url ?? "unknown").split("?", 1)[0];
      if (path === "/health") return;
      logger.info("agent http request", {
        request_id: requestId,
        method: req.method ?? "UNKNOWN",
        path,
        status: res.statusCode,
        duration_ms: Math.round((performance.now() - startedAt) * 10) / 10,
      });
    });
    if (!req.url) {
      res.writeHead(400);
      res.end("Missing URL");
      return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host ?? "127.0.0.1"}`);
    const pathname = parsedUrl.pathname;

    if (req.method === "GET" && pathname === "/health") {
      sendHealthResponse(req, res);
      return;
    }

    if (req.method === "GET" && pathname === "/fs/list") {
      if (!requireGatewayAuth(req, res)) return;
      try {
        const requested = parsedUrl.searchParams.get("path") ?? "~";
        const hidden = parsedUrl.searchParams.get("hidden") === "1";
        sendJson(res, 200, await listDirectory(requested, hidden));
      } catch (error) {
        sendError(res, 400, error, "Filesystem error");
      }
      return;
    }

    if (req.method === "GET" && pathname === "/fs/read") {
      if (!requireGatewayAuth(req, res)) return;
      try {
        sendJson(res, 200, await readFileText(parsedUrl.searchParams.get("path") ?? "~"));
      } catch (error) {
        sendError(res, 400, error, "Read error");
      }
      return;
    }

    if (req.method === "GET" && pathname === "/fs/usage") {
      if (!requireGatewayAuth(req, res)) return;
      try {
        sendJson(res, 200, await diskUsage(parsedUrl.searchParams.get("path") ?? "~"));
      } catch (error) {
        sendError(res, 400, error, "Usage error");
      }
      return;
    }

    if (req.method === "POST" && pathname === "/fs/write") {
      if (!requireGatewayAuth(req, res)) return;
      try {
        const b = await readJsonBody<{ path?: string; content?: string }>(req);
        sendJson(res, 200, await writeFileText(b.path ?? "", b.content ?? ""));
      } catch (error) {
        sendError(res, 400, error, "Write error");
      }
      return;
    }

    if (req.method === "POST" && pathname === "/fs/mkdir") {
      if (!requireGatewayAuth(req, res)) return;
      try {
        const b = await readJsonBody<{ path?: string }>(req);
        sendJson(res, 200, await makeDir(b.path ?? ""));
      } catch (error) {
        sendError(res, 400, error, "Mkdir error");
      }
      return;
    }

    if (req.method === "POST" && pathname === "/fs/delete") {
      if (!requireGatewayAuth(req, res)) return;
      try {
        const b = await readJsonBody<{ path?: string }>(req);
        sendJson(res, 200, await removePath(b.path ?? ""));
      } catch (error) {
        sendError(res, 400, error, "Delete error");
      }
      return;
    }

    if (req.method === "POST" && pathname === "/fs/move") {
      if (!requireGatewayAuth(req, res)) return;
      try {
        const b = await readJsonBody<{ from?: string; to?: string }>(req);
        sendJson(res, 200, await movePath(b.from ?? "", b.to ?? ""));
      } catch (error) {
        sendError(res, 400, error, "Move error");
      }
      return;
    }

    if (req.method === "POST" && pathname === "/fs/copy") {
      if (!requireGatewayAuth(req, res)) return;
      try {
        const b = await readJsonBody<{ from?: string; to?: string }>(req);
        sendJson(res, 200, await copyPath(b.from ?? "", b.to ?? ""));
      } catch (error) {
        sendError(res, 400, error, "Copy error");
      }
      return;
    }


    if (req.method === "GET" && pathname === "/skills") {
      if (!requireGatewayAuth(req, res)) return;
      try {
        const cwd = parsedUrl.searchParams.get("cwd") ?? undefined;
        const skills = await listSkills(cwd);
        sendJson(res, 200, { skills });
      } catch (error) {
        sendError(res, 400, error, "Skills error");
      }
      return;
    }

    if (pathname.startsWith("/state/")) {
      if (!requireGatewayAuth(req, res)) return;
      const key = pathname.slice("/state/".length);
      try {
        if (req.method === "GET") {
          const value = await readJsonState(key);
          sendJson(res, 200, { value });
          return;
        }
        if (req.method === "PUT") {
          let raw = "";
          let size = 0;
          for await (const chunk of req) {
            size += (chunk as Buffer).length;
            if (size > MAX_STATE_BODY_BYTES) {
              sendJson(res, 413, { error: "Request body too large" });
              return;
            }
            raw += chunk;
          }
          // Treat a blank/whitespace-only body as a dropped/no-op state push.
          // Skip the write entirely: persisting `null` would destroy the stored
          // state instead of preserving the last known-good value.
          // Only a non-empty body that still fails JSON.parse is a genuine 400.
          const trimmed = raw.trim();
          if (trimmed.length === 0) {
            res.writeHead(204);
            res.end();
            return;
          }
          let parsed: unknown;
          try {
            parsed = JSON.parse(trimmed);
          } catch {
            sendJson(res, 400, { error: "Invalid JSON body" });
            return;
          }
          await writeJsonState(key, parsed);
          res.writeHead(204);
          res.end();
          return;
        }
        sendJson(res, 405, { error: "Method not allowed" });
        return;
      } catch (error) {
        sendError(res, 500, error, "State error");
        return;
      }
    }

    if (pathname === "/log" || pathname === "/api/log") {
      if (!requireGatewayAuth(req, res)) return;
      try {
        if (req.method === "GET") {
          const sinceParam = parsedUrl.searchParams.get("since");
          const levelParam = parsedUrl.searchParams.get("level") as LogLevel | null;
          const limitParam = parsedUrl.searchParams.get("limit");
          const entries = await readLog({
            since: sinceParam ? Number(sinceParam) : undefined,
            level: levelParam ?? undefined,
            limit: limitParam ? Number(limitParam) : undefined,
          });
          sendJson(res, 200, { entries });
          return;
        }
        if (req.method === "DELETE") {
          sendJson(res, 200, await cleanupLog());
          return;
        }
        sendJson(res, 405, { error: "Method not allowed" });
        return;
      } catch (error) {
        sendError(res, 500, error, "Log error");
        return;
      }
    }

    if (await handleTerminalHttpRequest(req, res, pathname)) {
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  });

  server.on("upgrade", (req, socket, head) => {
    if (!wsServer) {
      socket.destroy();
      return;
    }

    handleTerminalSocketUpgrade(
      req,
      socket,
      head,
      wsServer,
      config.GATEWAY_SECRET
    );
  });

  server.on("error", (err) => {
    logger.error("Health server error", { error: String(err) });
  });

  server.listen(config.AGENT_HEALTH_PORT, config.AGENT_HEALTH_HOST, () => {
    logger.info("Health server listening", {
      host: config.AGENT_HEALTH_HOST,
      port: config.AGENT_HEALTH_PORT,
    });
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
