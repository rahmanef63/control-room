import crypto from "crypto";
import type http from "http";

interface SessionPayload {
  issued_at: number;
  expires_at: number;
}

function base64urlEncode(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64urlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4;
  return Buffer.from(pad ? padded + "=".repeat(4 - pad) : padded, "base64");
}

function verifyLegacySession(cookie: string, secret: string): SessionPayload | null {
  try {
    const parts = cookie.split(".");
    if (parts.length !== 2) return null;
    const [encodedPayload, providedSig] = parts;
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(encodedPayload);
    const expectedSig = base64urlEncode(hmac.digest());
    const expectedBuf = Buffer.from(expectedSig, "utf8");
    const providedBuf = Buffer.from(providedSig, "utf8");
    if (expectedBuf.length !== providedBuf.length) return null;
    if (!crypto.timingSafeEqual(expectedBuf, providedBuf)) return null;
    const payload = JSON.parse(base64urlDecode(encodedPayload).toString("utf8")) as SessionPayload;
    if (payload.expires_at <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(header: string | undefined): Map<string, string> {
  const cookies = new Map<string, string>();
  if (!header) return cookies;
  for (const entry of header.split(";")) {
    const [rawKey, ...rawValue] = entry.trim().split("=");
    if (rawKey) cookies.set(rawKey, rawValue.join("="));
  }
  return cookies;
}

export function isAuthorizedGatewayRequest(
  req: http.IncomingMessage,
  controlRoomSecret: string | undefined
): boolean {
  if (!controlRoomSecret) return false;
  const provided = req.headers["x-control-room-secret"];
  if (typeof provided !== "string") return false;
  const expectedBuf = Buffer.from(controlRoomSecret, "utf8");
  const providedBuf = Buffer.from(provided, "utf8");
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

/**
 * Machine-to-machine gateway auth is canonical for terminal WebSockets. The
 * signed-session fallback exists only for one rollback-compatible release: the
 * previous frontend still forwards browser cookies. Because the agent is now
 * bound to loopback and Traefik no longer exposes /ws/terminals, this fallback
 * is not reachable directly from the public web and can be removed after the
 * rollback window expires.
 */
export function isAuthorizedTerminalSocket(
  req: http.IncomingMessage,
  gatewaySecret: string | undefined,
  legacySessionSecret?: string
): boolean {
  if (isAuthorizedGatewayRequest(req, gatewaySecret)) return true;
  if (!legacySessionSecret) return false;
  const sessionCookie = parseCookies(req.headers.cookie).get("session");
  return Boolean(sessionCookie && verifyLegacySession(sessionCookie, legacySessionSecret));
}
