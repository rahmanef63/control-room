import http from "http";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { isConvexConnected } from "./convex-client.js";

let server: http.Server | null = null;
let lastSnapshot: number | null = null;

export function updateLastSnapshot(ts: number): void {
  lastSnapshot = ts;
}

export function startHealthServer(): void {
  server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      const body = JSON.stringify({
        status: "ok",
        uptime: process.uptime(),
        convex_connected: isConvexConnected(),
        last_snapshot: lastSnapshot,
      });

      res.writeHead(200, {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      });
      res.end(body);
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
    }
  });

  server.on("error", (err) => {
    logger.error("Health server error", { error: String(err) });
  });

  server.listen(config.AGENT_HEALTH_PORT, "0.0.0.0", () => {
    logger.info("Health server listening", { port: config.AGENT_HEALTH_PORT });
  });
}

export function stopHealthServer(): void {
  if (server) {
    server.close(() => {
      logger.info("Health server stopped");
    });
    server = null;
  }
}
