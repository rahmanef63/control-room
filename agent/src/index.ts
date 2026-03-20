import { config } from "./config.js";
import { logger } from "./logger.js";
import { mutate } from "./convex-client.js";
import { collectSystem } from "./collectors/system.js";
import { collectDocker } from "./collectors/docker.js";
import { collectDokploy } from "./collectors/dokploy.js";
import { collectAgents } from "./collectors/agents.js";
import { collectSecurity } from "./collectors/security.js";
import { updateKnownTargets } from "./executor/allowlist.js";
import { startExecutor, stopExecutor } from "./executor/index.js";
import { startHealthServer, stopHealthServer, updateLastSnapshot } from "./health.js";
import type { AppStatus } from "./collectors/docker.js";

logger.info("VPS Control Room Agent starting...", {
  convex_url: config.CONVEX_URL,
  health_port: config.AGENT_HEALTH_PORT,
});

// ─── Interval tracking ──────────────────────────────────────────────────────

const intervals: Array<ReturnType<typeof setInterval>> = [];

function addInterval(fn: () => Promise<void>, ms: number): void {
  const handle = setInterval(() => {
    fn().catch((err) => {
      logger.error("Unhandled error in collector interval", {
        error: String(err),
      });
    });
  }, ms);
  intervals.push(handle);
}

function clearAllIntervals(): void {
  for (const handle of intervals) {
    clearInterval(handle);
  }
  intervals.length = 0;
}

// ─── Alert threshold helpers ─────────────────────────────────────────────────

type AlertSeverity = "warning" | "error" | "critical";

async function maybeAlert(
  type: string,
  label: string,
  value: number,
  warnThreshold: number,
  critThreshold: number
): Promise<void> {
  if (value >= critThreshold) {
    await mutate("api/alerts:upsertAlert", {
      type,
      message: `${label} is at ${value.toFixed(1)}% (critical threshold: ${critThreshold}%)`,
      severity: "critical" as AlertSeverity,
      target: label,
    });
  } else if (value >= warnThreshold) {
    await mutate("api/alerts:upsertAlert", {
      type,
      message: `${label} is at ${value.toFixed(1)}% (warning threshold: ${warnThreshold}%)`,
      severity: "warning" as AlertSeverity,
      target: label,
    });
  }
}

// ─── System collector loop ───────────────────────────────────────────────────

async function runSystemCollector(): Promise<void> {
  try {
    const snapshot = await collectSystem();

    await mutate("api/snapshots:upsertSystemSnapshot", {
      timestamp: snapshot.timestamp,
      cpu_total: snapshot.cpu_total,
      cpu_cores: snapshot.cpu_cores,
      ram_total: snapshot.ram_total,
      ram_used: snapshot.ram_used,
      ram_available: snapshot.ram_available,
      disk: snapshot.disk,
      network: snapshot.network,
      uptime_seconds: snapshot.uptime_seconds,
      load_average: snapshot.load_average,
    });

    updateLastSnapshot(snapshot.timestamp);

    // Check CPU threshold
    await maybeAlert(
      "cpu_high",
      "CPU",
      snapshot.cpu_total,
      config.ALERT_CPU_WARNING_PERCENT,
      config.ALERT_CPU_CRITICAL_PERCENT
    );

    // Check RAM threshold
    if (snapshot.ram_total > 0) {
      const ramPercent = (snapshot.ram_used / snapshot.ram_total) * 100;
      await maybeAlert(
        "ram_high",
        "RAM",
        ramPercent,
        config.ALERT_RAM_WARNING_PERCENT,
        config.ALERT_RAM_CRITICAL_PERCENT
      );
    }

    // Check disk thresholds
    for (const diskEntry of snapshot.disk) {
      if (diskEntry.total > 0) {
        const diskPercent = (diskEntry.used / diskEntry.total) * 100;
        await maybeAlert(
          `disk_high_${diskEntry.mount.replace(/\//g, "_")}`,
          `Disk ${diskEntry.mount}`,
          diskPercent,
          config.ALERT_DISK_WARNING_PERCENT,
          config.ALERT_DISK_CRITICAL_PERCENT
        );
      }
    }
  } catch (err) {
    logger.error("System collector error", { error: String(err) });
  }
}

// ─── Docker + Dokploy collector loop ────────────────────────────────────────

async function runAppCollector(): Promise<void> {
  try {
    const [dockerApps, dokployApps] = await Promise.all([
      collectDocker().catch((err) => {
        logger.error("Docker collector error", { error: String(err) });
        return [] as AppStatus[];
      }),
      collectDokploy().catch((err) => {
        logger.error("Dokploy collector error", { error: String(err) });
        return [] as Partial<AppStatus>[];
      }),
    ]);

    // Merge: dokploy apps may override docker apps of the same name
    const appMap = new Map<string, AppStatus>();

    for (const app of dockerApps) {
      appMap.set(app.name, app);
    }

    for (const partial of dokployApps) {
      if (!partial.name) continue;
      const existing = appMap.get(partial.name);
      if (existing) {
        // Merge dokploy data on top
        appMap.set(partial.name, {
          ...existing,
          ...partial,
          ports: partial.ports ?? existing.ports,
          source: "dokploy",
        } as AppStatus);
      } else {
        // Only include if it has required fields
        if (
          partial.runtime_status &&
          partial.health_status &&
          partial.ports
        ) {
          appMap.set(partial.name, partial as AppStatus);
        }
      }
    }

    // Update known container targets for executor
    const containerNames = dockerApps.map((a) => a.name);
    updateKnownTargets("container", containerNames);

    // Update dokploy-app targets
    const dokployNames = dokployApps
      .filter((a) => a.name)
      .map((a) => a.name as string);
    updateKnownTargets("dokploy-app", dokployNames);

    // Upsert all apps to Convex
    for (const app of appMap.values()) {
      try {
        // Normalize ports: published must be a number (not null) for Convex schema
        const normalizedPorts = app.ports.map((p) => ({
          internal: p.internal,
          published: p.published ?? 0,
          protocol: p.protocol,
        }));

        await mutate("api/appStatus:upsertAppStatus", {
          name: app.name,
          source: app.source,
          runtime_status: app.runtime_status,
          health_status: app.health_status,
          ports: normalizedPorts,
          ...(app.domain !== undefined ? { domain: app.domain } : {}),
          last_seen: app.last_seen,
          ...(app.restart_count !== undefined
            ? { restart_count: app.restart_count }
            : {}),
          ...(app.last_deploy_time !== undefined
            ? { last_deploy_time: app.last_deploy_time }
            : {}),
          ...(app.last_known_error !== undefined
            ? { last_known_error: app.last_known_error }
            : {}),
          ...(app.metadata !== undefined ? { metadata: app.metadata } : {}),
        });
      } catch (err) {
        logger.error("Failed to upsert app status", {
          name: app.name,
          error: String(err),
        });
      }
    }
  } catch (err) {
    logger.error("App collector error", { error: String(err) });
  }
}

// ─── Agents collector loop ───────────────────────────────────────────────────

async function runAgentsCollector(): Promise<void> {
  try {
    const agents = await collectAgents();

    // Update known service/agent targets for executor
    const runningAgentNames = agents
      .filter((a) => a.status === "running")
      .map((a) => a.name);
    updateKnownTargets("service", runningAgentNames);
    updateKnownTargets("agent", agents.map((a) => a.name));

    for (const agent of agents) {
      try {
        await mutate("api/agentStatus:upsertAgentStatus", {
          name: agent.name,
          ...(agent.pid !== undefined ? { pid: agent.pid } : {}),
          status: agent.status,
          cpu: agent.cpu,
          memory: agent.memory,
          uptime_seconds: agent.uptime_seconds,
          last_seen: agent.last_seen,
          detection_source: agent.detection_source,
          available_actions: agent.available_actions,
          ...(agent.metadata !== undefined ? { metadata: agent.metadata } : {}),
        });
      } catch (err) {
        logger.error("Failed to upsert agent status", {
          name: agent.name,
          error: String(err),
        });
      }
    }
  } catch (err) {
    logger.error("Agents collector error", { error: String(err) });
  }
}

// ─── Security collector loop ─────────────────────────────────────────────────

async function runSecurityCollector(): Promise<void> {
  try {
    const security = await collectSecurity();

    // Update known fail2ban targets (banned IPs can be unbanned)
    updateKnownTargets("fail2ban", security.fail2ban_status.banned_ips);

    // Emit security events
    for (const event of security.events_to_emit) {
      try {
        // Map severity string to valid Convex event severity
        type EventSeverity = "info" | "warning" | "error" | "critical";
        const severityMap: Record<string, EventSeverity> = {
          info: "info",
          warning: "warning",
          error: "error",
          critical: "critical",
        };
        const severity: EventSeverity =
          severityMap[event.severity] ?? "warning";

        await mutate("api/events:insertEvent", {
          timestamp: Date.now(),
          type: event.type,
          message: event.message,
          severity,
          source: event.source,
        });
      } catch (err) {
        logger.error("Failed to insert security event", {
          type: event.type,
          error: String(err),
        });
      }
    }
  } catch (err) {
    logger.error("Security collector error", { error: String(err) });
  }
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────

let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info("Shutting down agent", { signal });

  // Stop accepting new work
  clearAllIntervals();

  // Stop executor (waits up to 10s for running commands)
  await stopExecutor();

  // Stop health server
  stopHealthServer();

  // Log shutdown to Convex (best effort)
  try {
    await mutate("api/events:insertEvent", {
      timestamp: Date.now(),
      type: "agent_shutdown",
      message: `Agent shutting down (signal: ${signal})`,
      severity: "info",
      source: "agent",
    });
  } catch {
    // Ignore - connection may already be gone
  }

  logger.info("Agent shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => {
  shutdown("SIGTERM").catch((err) => {
    logger.error("Error during SIGTERM shutdown", { error: String(err) });
    process.exit(1);
  });
});

process.on("SIGINT", () => {
  shutdown("SIGINT").catch((err) => {
    logger.error("Error during SIGINT shutdown", { error: String(err) });
    process.exit(1);
  });
});

process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception", { error: String(err), stack: err.stack });
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", { reason: String(reason) });
});

// ─── Bootstrap ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  logger.info("Agent initialized, starting collectors...");

  // Run first collection immediately
  await Promise.allSettled([
    runSystemCollector(),
    runAppCollector(),
    runAgentsCollector(),
    runSecurityCollector(),
  ]);

  // Schedule recurring collection
  addInterval(runSystemCollector, config.SYSTEM_POLL_INTERVAL_MS);
  addInterval(runAppCollector, config.DOCKER_POLL_INTERVAL_MS);
  addInterval(runAgentsCollector, config.AGENT_POLL_INTERVAL_MS);
  addInterval(runSecurityCollector, config.SECURITY_POLL_INTERVAL_MS);

  // Start executor
  startExecutor();

  // Start health server
  startHealthServer();

  logger.info("Agent running", {
    system_poll_ms: config.SYSTEM_POLL_INTERVAL_MS,
    docker_poll_ms: config.DOCKER_POLL_INTERVAL_MS,
    agent_poll_ms: config.AGENT_POLL_INTERVAL_MS,
    security_poll_ms: config.SECURITY_POLL_INTERVAL_MS,
    command_poll_ms: config.AGENT_COMMAND_POLL_INTERVAL_MS,
  });

  // Log startup event (best effort)
  try {
    await mutate("api/events:insertEvent", {
      timestamp: Date.now(),
      type: "agent_startup",
      message: "VPS Control Room Agent started",
      severity: "info",
      source: "agent",
    });
  } catch (err) {
    logger.warn("Could not log startup event to Convex", {
      error: String(err),
    });
  }
}

main().catch((err) => {
  logger.error("Fatal error during agent startup", {
    error: String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  process.exit(1);
});
