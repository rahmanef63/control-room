import https from "https";
import http from "http";
import { config } from "../config.js";
import { logger } from "../logger.js";
import type { AppStatus } from "./docker.js";
import type { AppMetadata } from "../../../packages/contracts/index.js";

interface DokployApplication {
  name: string;
  appName?: string;
  projectId?: string;
  project_id?: string;
  applicationId?: string;
  application_id?: string;
  applicationStatus?: string;
  status?: string;
  domains?: Array<{ host: string; port?: number; https?: boolean }>;
  ports?: Array<{ publishedPort?: number; targetPort?: number; protocol?: string }>;
  errorMessage?: string;
  createdAt?: string;
  updatedAt?: string;
}

function dokployStatusToRuntimeStatus(
  status?: string
): AppStatus["runtime_status"] {
  if (!status) return "unknown";
  switch (status.toLowerCase()) {
    case "running":
    case "done":
      return "running";
    case "stopped":
    case "exited":
      return "stopped";
    case "error":
    case "failed":
      return "error";
    case "restarting":
      return "restarting";
    default:
      return "unknown";
  }
}

function httpGet(url: string, authHeader: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === "https:";
    const transport = isHttps ? https : http;

    const req = transport.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port
          ? parseInt(parsedUrl.port, 10)
          : isHttps
          ? 443
          : 80,
        path: parsedUrl.pathname + parsedUrl.search,
        method: "GET",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        rejectUnauthorized: false, // allow self-signed certs in local Dokploy setups
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        res.on("error", reject);
      }
    );

    req.on("error", reject);
    req.setTimeout(8000, () => {
      req.destroy(new Error("Dokploy API request timed out"));
    });
    req.end();
  });
}

export async function collectDokploy(): Promise<Partial<AppStatus>[]> {
  if (!config.DOKPLOY_URL || !config.DOKPLOY_API_KEY) {
    return [];
  }

  try {
    const url = `${config.DOKPLOY_URL}/api/application.all`;
    const raw = await httpGet(
      url,
      `Bearer ${config.DOKPLOY_API_KEY}`
    );

    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      logger.warn("Failed to parse Dokploy response", {
        raw: raw.slice(0, 200),
      });
      return [];
    }

    const apps: DokployApplication[] = Array.isArray(data)
      ? (data as DokployApplication[])
      : [];

    return apps.map((app) => {
      const name = app.appName ?? app.name;
      const runtime_status = dokployStatusToRuntimeStatus(
        app.applicationStatus ?? app.status
      );
      const dokployProjectId = app.projectId ?? app.project_id;
      const dokployApplicationId = app.applicationId ?? app.application_id;

      const domain = app.domains?.[0]?.host;

      const ports: AppStatus["ports"] = (app.ports ?? []).map((p) => ({
        internal: p.targetPort ?? 80,
        published: p.publishedPort ?? null,
        protocol: p.protocol ?? "tcp",
      }));

      const metadata: AppMetadata = {
        dokploy_name: app.name,
        dokploy_project_id: dokployProjectId,
        dokploy_application_id: dokployApplicationId,
        created_at: app.createdAt,
        command_targets: {
          ...(dokployProjectId ? { dokploy_project: dokployProjectId } : {}),
        },
      };

      const partial: Partial<AppStatus> = {
        name,
        source: "dokploy",
        runtime_status,
        health_status: "none",
        ports,
        domain,
        last_seen: Date.now(),
        last_known_error: app.errorMessage ?? undefined,
        last_deploy_time: app.updatedAt
          ? new Date(app.updatedAt).getTime()
          : undefined,
        metadata,
      };

      return partial;
    });
  } catch (err) {
    logger.warn("Dokploy collector unavailable", { error: String(err) });
    return [];
  }
}
