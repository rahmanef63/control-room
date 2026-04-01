import { v } from "convex/values";

export const eventSeverityValidator = v.union(
  v.literal("info"),
  v.literal("warning"),
  v.literal("error"),
  v.literal("critical")
);

export const alertSeverityValidator = v.union(
  v.literal("warning"),
  v.literal("error"),
  v.literal("critical")
);

export const alertStatusValidator = v.union(
  v.literal("active"),
  v.literal("resolved"),
  v.literal("acknowledged")
);

export const auditResultValidator = v.union(
  v.literal("success"),
  v.literal("failed"),
  v.literal("cancelled")
);

export const auditSeverityValidator = v.union(
  v.literal("info"),
  v.literal("warning"),
  v.literal("critical")
);

export const auditTriggeredByValidator = v.union(
  v.literal("manual-dashboard"),
  v.literal("manual-cli"),
  v.literal("manual-tui"),
  v.literal("system-agent"),
  v.literal("scheduled-check")
);

export const agentRuntimeStatusValidator = v.union(
  v.literal("running"),
  v.literal("stopped"),
  v.literal("unknown")
);

export const agentDetectionSourceValidator = v.union(
  v.literal("process"),
  v.literal("container"),
  v.literal("systemd"),
  v.literal("pidfile")
);

export const appSourceValidator = v.union(
  v.literal("dokploy"),
  v.literal("docker"),
  v.literal("systemd")
);

export const appRuntimeStatusValidator = v.union(
  v.literal("running"),
  v.literal("stopped"),
  v.literal("restarting"),
  v.literal("error"),
  v.literal("unknown")
);

export const appHealthStatusValidator = v.union(
  v.literal("healthy"),
  v.literal("unhealthy"),
  v.literal("none"),
  v.literal("unknown")
);

export const commandTargetTypeValidator = v.union(
  v.literal("container"),
  v.literal("service"),
  v.literal("agent"),
  v.literal("dokploy-app"),
  v.literal("fail2ban")
);

export const commandStatusValidator = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("success"),
  v.literal("failed"),
  v.literal("cancelled"),
  v.literal("timeout")
);

export const portValidator = v.object({
  internal: v.number(),
  published: v.number(),
  protocol: v.string(),
});

export const diskEntryValidator = v.object({
  mount: v.string(),
  total: v.number(),
  used: v.number(),
  available: v.number(),
});

export const networkValidator = v.object({
  rx_bytes: v.number(),
  tx_bytes: v.number(),
  rx_rate: v.number(),
  tx_rate: v.number(),
});

export const eventsFields = {
  timestamp: v.number(),
  type: v.string(),
  message: v.string(),
  severity: eventSeverityValidator,
  source: v.string(),
  target: v.optional(v.string()),
  metadata: v.optional(v.any()),
};

export const auditLogFields = {
  timestamp: v.number(),
  action: v.string(),
  target: v.string(),
  result: auditResultValidator,
  severity: auditSeverityValidator,
  triggered_by: auditTriggeredByValidator,
  request_id: v.string(),
  metadata: v.optional(v.any()),
};

export const agentStatusFields = {
  name: v.string(),
  pid: v.optional(v.number()),
  status: agentRuntimeStatusValidator,
  cpu: v.number(),
  memory: v.number(),
  uptime_seconds: v.number(),
  last_seen: v.number(),
  detection_source: agentDetectionSourceValidator,
  available_actions: v.array(v.string()),
  metadata: v.optional(v.any()),
};

export const systemSnapshotFields = {
  timestamp: v.number(),
  cpu_total: v.number(),
  cpu_cores: v.array(v.number()),
  ram_total: v.number(),
  ram_used: v.number(),
  ram_available: v.number(),
  disk: v.array(diskEntryValidator),
  network: networkValidator,
  uptime_seconds: v.number(),
  load_average: v.array(v.number()),
};

export const alertsFields = {
  type: v.string(),
  message: v.string(),
  severity: alertSeverityValidator,
  status: alertStatusValidator,
  created_at: v.number(),
  resolved_at: v.optional(v.number()),
  metadata: v.optional(v.any()),
};

export const commandsFields = {
  request_id: v.string(),
  action: v.string(),
  target_type: commandTargetTypeValidator,
  target_id: v.string(),
  payload: v.optional(v.any()),
  status: commandStatusValidator,
  requested_by: v.string(),
  requested_at: v.number(),
  started_at: v.optional(v.number()),
  finished_at: v.optional(v.number()),
  result: v.optional(v.string()),
  error: v.optional(v.string()),
};

export const appStatusFields = {
  name: v.string(),
  source: appSourceValidator,
  runtime_status: appRuntimeStatusValidator,
  health_status: appHealthStatusValidator,
  ports: v.array(portValidator),
  domain: v.optional(v.string()),
  last_seen: v.number(),
  restart_count: v.optional(v.number()),
  last_deploy_time: v.optional(v.number()),
  last_known_error: v.optional(v.string()),
  metadata: v.optional(v.any()),
};
