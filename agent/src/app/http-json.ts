import type http from "http";

import { config } from "../config.js";
import { isAuthorizedGatewayRequest } from "../terminal/auth.js";

// Cap request bodies so one oversized payload can't OOM the host-control daemon.
const MAX_BODY_BYTES = 1_000_000;
// Larger ceiling for binary uploads (drag-and-drop media) — still bounded.
const MAX_UPLOAD_BYTES = 26_214_400; // 25 MiB

export function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

// Collapses the repeated `error instanceof Error ? error.message : 'X'` ternary
// into a single JSON error response with a typed fallback message.
export function sendError(
  res: http.ServerResponse,
  status: number,
  error: unknown,
  fallback: string
): void {
  sendJson(res, status, {
    error: error instanceof Error ? error.message : fallback,
  });
}

// Returns true when the caller is authorized; otherwise writes a 401 and
// returns false so handlers can `if (!requireGatewayAuth(req, res)) return ...`.
export function requireGatewayAuth(
  req: http.IncomingMessage,
  res: http.ServerResponse
): boolean {
  if (isAuthorizedGatewayRequest(req, config.GATEWAY_SECRET)) return true;
  sendJson(res, 401, { error: "Unauthorized" });
  return false;
}

export function readJsonBody<T = unknown>(req: http.IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(Buffer.from(chunk));
    });
    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({} as T);
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as T);
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

// Buffers a raw (binary) request body for file uploads. Bounded by
// MAX_UPLOAD_BYTES so a huge drop can't exhaust host memory.
export function readRawBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_UPLOAD_BYTES) {
        reject(new Error("Upload too large (max 25 MiB)"));
        req.destroy();
        return;
      }
      chunks.push(Buffer.from(chunk));
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
