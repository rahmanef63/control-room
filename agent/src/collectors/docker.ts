import http from "http";
import { config } from "../config.js";
import { logger } from "../logger.js";

export interface AppStatus {
  name: string;
  source: "docker" | "dokploy" | "systemd";
  runtime_status: "running" | "stopped" | "restarting" | "error" | "unknown";
  health_status: "healthy" | "unhealthy" | "none" | "unknown";
  ports: Array<{ internal: number; published: number | null; protocol: string }>;
  domain?: string;
  last_seen: number;
  restart_count?: number;
  last_deploy_time?: number;
  last_known_error?: string;
  metadata?: Record<string, unknown>;
}

interface DockerPort {
  IP?: string;
  PrivatePort: number;
  PublicPort?: number;
  Type: string;
}

interface DockerHealthState {
  Status: string;
}

interface DockerState {
  Status: string;
  Health?: DockerHealthState;
}

interface DockerContainer {
  Id: string;
  Names: string[];
  State: string;
  Status: string;
  Ports: DockerPort[];
  RestartCount?: number;
  Created?: number;
  Labels?: Record<string, string>;
  // Extended info available via /containers/{id}/json
  HostConfig?: Record<string, unknown>;
}

function dockerStateToRuntimeStatus(
  state: string
): AppStatus["runtime_status"] {
  switch (state.toLowerCase()) {
    case "running":
      return "running";
    case "exited":
    case "dead":
      return "stopped";
    case "restarting":
      return "restarting";
    case "paused":
    case "removing":
      return "stopped";
    case "created":
      return "stopped";
    default:
      return "unknown";
  }
}

function dockerHealthToHealthStatus(
  health?: string
): AppStatus["health_status"] {
  if (!health) return "none";
  switch (health.toLowerCase()) {
    case "healthy":
      return "healthy";
    case "unhealthy":
      return "unhealthy";
    case "starting":
      return "unknown";
    case "none":
      return "none";
    default:
      return "unknown";
  }
}

function httpGetUnixSocket(
  socketPath: string,
  path: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        socketPath,
        path,
        method: "GET",
        headers: { Host: "localhost" },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    req.setTimeout(5000, () => {
      req.destroy(new Error("Docker socket request timed out"));
    });
    req.end();
  });
}

export async function collectDocker(): Promise<AppStatus[]> {
  try {
    const raw = await httpGetUnixSocket(
      config.DOCKER_SOCKET_PATH,
      "/containers/json?all=true"
    );

    let containers: DockerContainer[];
    try {
      containers = JSON.parse(raw) as DockerContainer[];
    } catch {
      logger.error("Failed to parse Docker containers response", {
        raw: raw.slice(0, 200),
      });
      return [];
    }

    if (!Array.isArray(containers)) {
      return [];
    }

    const results: AppStatus[] = [];

    for (const container of containers) {
      // Container name - strip leading slash
      const rawName = container.Names?.[0] ?? container.Id.slice(0, 12);
      const name = rawName.startsWith("/") ? rawName.slice(1) : rawName;

      const runtime_status = dockerStateToRuntimeStatus(container.State);

      // Health: try to get from Status string which may include "(healthy)" etc
      let health_status: AppStatus["health_status"] = "none";
      const statusStr = container.Status ?? "";
      if (statusStr.includes("(healthy)")) {
        health_status = "healthy";
      } else if (statusStr.includes("(unhealthy)")) {
        health_status = "unhealthy";
      } else if (statusStr.includes("(health: starting)")) {
        health_status = "unknown";
      }

      const ports: AppStatus["ports"] = (container.Ports ?? []).map(
        (p: DockerPort) => ({
          internal: p.PrivatePort,
          published: p.PublicPort ?? null,
          protocol: p.Type ?? "tcp",
        })
      );

      // Try to extract domain from labels
      const labels = container.Labels ?? {};
      const domain =
        labels["traefik.http.routers.default.rule"]
          ?.match(/Host\(`([^`]+)`\)/)?.[1] ??
        labels["caddy"] ??
        undefined;

      const appStatus: AppStatus = {
        name,
        source: "docker",
        runtime_status,
        health_status,
        ports,
        domain,
        last_seen: Date.now(),
        restart_count: container.RestartCount,
        last_deploy_time: container.Created
          ? container.Created * 1000
          : undefined,
        metadata: {
          container_id: container.Id.slice(0, 12),
          image_status: container.Status,
          labels: Object.keys(labels).length > 0 ? labels : undefined,
        },
      };

      results.push(appStatus);
    }

    return results;
  } catch (err) {
    logger.warn("Docker collector unavailable", { error: String(err) });
    return [];
  }
}
