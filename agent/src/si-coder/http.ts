import type http from "http";

import { readJsonBody, requireGatewayAuth, sendError, sendJson } from "../app/http-json.js";
import { callSiCoderTool, listSiCoderTools } from "./bridge.js";

interface ToolCallBody {
  name?: string;
  arguments?: Record<string, unknown>;
}

export async function handleSiCoderHttpRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string
): Promise<boolean> {
  if (pathname !== "/si-coder/tools" && pathname !== "/si-coder/tools/call") return false;
  if (!requireGatewayAuth(req, res)) return true;

  try {
    if (pathname === "/si-coder/tools" && req.method === "GET") {
      sendJson(res, 200, await listSiCoderTools());
      return true;
    }
    if (pathname === "/si-coder/tools/call" && req.method === "POST") {
      const body = await readJsonBody<ToolCallBody>(req);
      if (typeof body.name !== "string" || !body.name.startsWith("sc.")) {
        sendJson(res, 400, { error: "A valid SI-Coder tool name is required" });
        return true;
      }
      const result = await callSiCoderTool(body.name, body.arguments ?? {});
      sendJson(res, result.ok ? 200 : 422, result);
      return true;
    }
    sendJson(res, 405, { error: "Method not allowed" });
    return true;
  } catch (error) {
    sendError(res, 500, error, "SI-Coder integration error");
    return true;
  }
}
