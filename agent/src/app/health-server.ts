import http from "http";

import { WebSocketServer } from "ws";

import { config } from "../config.js";
import { isConvexConnected } from "../convex-client.js";
import { logger } from "../logger.js";
import { handleTerminalHttpRequest } from "../terminal/gateway/http.js";
import {
  handleTerminalSocketUpgrade,
  registerTerminalSocketServer,
} from "../terminal/gateway/socket.js";
import { terminalManager } from "../terminal/manager.js";

let server: http.Server | null = null;
let wsServer: WebSocketServer | null = null;
let lastSnapshot: number | null = null;

function sendHealthResponse(res: http.ServerResponse): void {
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

    const pathname = new URL(req.url, `http://${req.headers.host ?? "127.0.0.1"}`).pathname;

    if (req.method === "GET" && pathname === "/health") {
      sendHealthResponse(res);
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
