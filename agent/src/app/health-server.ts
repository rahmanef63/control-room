import http from "http";

import { WebSocketServer } from "ws";

import { config } from "../config.js";
import { isConvexConnected } from "../convex-client.js";
import { logger } from "../logger.js";
import { TERMINAL_PROFILES } from "../terminal/profiles.js";
import { handleTerminalHttpRequest } from "../terminal/gateway/http.js";
import {
  handleTerminalSocketUpgrade,
  registerTerminalSocketServer,
} from "../terminal/gateway/socket.js";
import { terminalManager } from "../terminal/manager.js";
import { isAuthorizedGatewayRequest } from "../terminal/auth.js";
import { listDirectory } from "../fs/explorer.js";
import { listSkills } from "../fs/skills.js";
import { getHostTelemetrySnapshot } from "./host-telemetry.js";
import {
  listEnvironmentSummaries,
  listResolvedAgentProfiles,
} from "../../../packages/runtime-config/index.js";

let server: http.Server | null = null;
let wsServer: WebSocketServer | null = null;
let lastSnapshot: number | null = null;

function sendHealthResponse(res: http.ServerResponse): void {
  const telemetry = getHostTelemetrySnapshot();
  const environments = listEnvironmentSummaries();
  const agentProfiles = listResolvedAgentProfiles();
  const body = JSON.stringify({
    status: "ok",
    mode: config.TERMINAL_ONLY_MODE ? "terminal-only" : "legacy",
    uptime: process.uptime(),
    convex_connected: isConvexConnected(),
    last_snapshot: telemetry?.timestamp ?? lastSnapshot,
    runtime: {
      terminal_sessions: terminalManager.listSessions().length,
      terminal_profiles: TERMINAL_PROFILES.length,
      environments: environments.length,
      agent_profiles: agentProfiles.length,
    },
    telemetry,
  });

  res.writeHead(200, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

export function updateLastSnapshot(ts: number): void {
  lastSnapshot = ts;
}

export function startHealthServer(): void {
  wsServer = new WebSocketServer({ noServer: true });
  registerTerminalSocketServer(wsServer);

  server = http.createServer(async (req, res) => {
    if (!req.url) {
      res.writeHead(400);
      res.end("Missing URL");
      return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host ?? "127.0.0.1"}`);
    const pathname = parsedUrl.pathname;

    if (req.method === "GET" && pathname === "/health") {
      sendHealthResponse(res);
      return;
    }

    if (req.method === "GET" && pathname === "/fs/list") {
      if (!isAuthorizedGatewayRequest(req, config.CONTROL_ROOM_SECRET)) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }
      try {
        const requested = parsedUrl.searchParams.get("path") ?? "~";
        const result = await listDirectory(requested);
        const body = JSON.stringify(result);
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        });
        res.end(body);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Filesystem error";
        const body = JSON.stringify({ error: message });
        res.writeHead(400, {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        });
        res.end(body);
      }
      return;
    }

    if (req.method === "GET" && pathname === "/skills") {
      if (!isAuthorizedGatewayRequest(req, config.CONTROL_ROOM_SECRET)) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }
      try {
        const skills = await listSkills();
        const body = JSON.stringify({ skills });
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        });
        res.end(body);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Skills error";
        const body = JSON.stringify({ error: message });
        res.writeHead(400, {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        });
        res.end(body);
      }
      return;
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
      config.CONTROL_ROOM_SESSION_SECRET
    );
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
