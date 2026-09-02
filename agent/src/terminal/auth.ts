import crypto from "crypto";
import type http from "http";

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

/** Terminal WebSockets use the same loopback machine-to-machine boundary. */
export function isAuthorizedTerminalSocket(
  req: http.IncomingMessage,
  gatewaySecret: string | undefined
): boolean {
  return isAuthorizedGatewayRequest(req, gatewaySecret);
}
