import type http from "http";
import type { Duplex } from "stream";
import { URL } from "url";

import WebSocket, { WebSocketServer, type RawData } from "ws";

import { logger } from "../../logger.js";
import { isAuthorizedTerminalSocket } from "../auth.js";
import { terminalManager } from "../manager.js";

interface TerminalUpgradeRequest extends http.IncomingMessage {
  terminalSessionId?: string;
}

interface TerminalSocketPayload {
  type?: string;
  data?: string;
  cols?: number;
  rows?: number;
}

// Outbound backpressure cap. ws.send queues unsent frames off-heap, which
// bypasses node's old-space limit — a stalled consumer (e.g. a browser busy
// booting two dozen xterm panes on login while live agent TUIs spew ANSI)
// once let this balloon to a 16 GB spike. When a socket's send buffer blows
// past the cap we drop it; the client's EventSource auto-reconnects and
// re-bootstraps from the bounded session buffer, so no screen state is lost.
const MAX_WS_BUFFER_BYTES = 8_000_000;

function parseWebSocketPayload(raw: RawData): TerminalSocketPayload | null {
  try {
    return JSON.parse(raw.toString("utf8")) as TerminalSocketPayload;
  } catch {
    return null;
  }
}

export function handleTerminalSocketUpgrade(
  req: http.IncomingMessage,
  socket: Duplex,
  head: Buffer,
  wsServer: WebSocketServer,
  gatewaySecret: string | undefined
): void {
  try {
    if (!req.url) {
      socket.destroy();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host ?? "127.0.0.1"}`);
    if (url.pathname !== "/ws/terminals") {
      socket.destroy();
      return;
    }

    if (!isAuthorizedTerminalSocket(req, gatewaySecret)) {
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
      wsServer.emit("connection", ws, upgradeReq);
    });
  } catch (error) {
    logger.error("Terminal socket upgrade error", { error: String(error) });
    socket.destroy();
  }
}

export function registerTerminalSocketServer(wsServer: WebSocketServer): void {
  wsServer.on("connection", (ws, req) => {
    const sessionId = (req as TerminalUpgradeRequest).terminalSessionId;
    if (!sessionId) {
      ws.close(4404, "Session not found");
      return;
    }

    let unsubscribe: (() => void) | null = null;

    try {
      unsubscribe = terminalManager.subscribe(sessionId, (event) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        if (ws.bufferedAmount > MAX_WS_BUFFER_BYTES) {
          logger.warn("Terminal socket backpressure exceeded, dropping client", {
            sessionId,
            bufferedAmount: ws.bufferedAmount,
          });
          ws.terminate();
          return;
        }
        ws.send(JSON.stringify(event));
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
      const payload = parseWebSocketPayload(raw);
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
}
