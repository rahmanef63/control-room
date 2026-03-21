import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  events: defineTable({
    timestamp: v.number(),
    type: v.string(),
    message: v.string(),
    severity: v.union(
      v.literal("info"),
      v.literal("warning"),
      v.literal("error"),
      v.literal("critical")
    ),
    source: v.string(),
    target: v.optional(v.string()),
    metadata: v.optional(v.any()),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_type", ["type", "timestamp"])
    .index("by_severity", ["severity", "timestamp"]),

  audit_log: defineTable({
    timestamp: v.number(),
    action: v.string(),
    target: v.string(),
    result: v.union(
      v.literal("success"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
    severity: v.union(
      v.literal("info"),
      v.literal("warning"),
      v.literal("critical")
    ),
    triggered_by: v.union(
      v.literal("manual-dashboard"),
      v.literal("manual-cli"),
      v.literal("manual-tui"),
      v.literal("system-agent"),
      v.literal("scheduled-check")
    ),
    request_id: v.string(),
    metadata: v.optional(v.any()),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_target", ["target", "timestamp"])
    .index("by_action", ["action", "timestamp"]),

  agent_status: defineTable({
    name: v.string(),
    pid: v.optional(v.number()),
    status: v.union(
      v.literal("running"),
      v.literal("stopped"),
      v.literal("unknown")
    ),
    cpu: v.number(),
    memory: v.number(),
    uptime_seconds: v.number(),
    last_seen: v.number(),
    detection_source: v.union(
      v.literal("process"),
      v.literal("container"),
      v.literal("systemd"),
      v.literal("pidfile")
    ),
    available_actions: v.array(v.string()),
    metadata: v.optional(v.any()),
  })
    .index("by_name", ["name"])
    .index("by_status", ["status"]),

  system_snapshot: defineTable({
    timestamp: v.number(),
    cpu_total: v.number(),
    cpu_cores: v.array(v.number()),
    ram_total: v.number(),
    ram_used: v.number(),
    ram_available: v.number(),
    disk: v.array(
      v.object({
        mount: v.string(),
        total: v.number(),
        used: v.number(),
        available: v.number(),
      })
    ),
    network: v.object({
      rx_bytes: v.number(),
      tx_bytes: v.number(),
      rx_rate: v.number(),
      tx_rate: v.number(),
    }),
    uptime_seconds: v.number(),
    load_average: v.array(v.number()),
  }).index("by_timestamp", ["timestamp"]),

  alerts: defineTable({
    type: v.string(),
    message: v.string(),
    severity: v.union(
      v.literal("warning"),
      v.literal("error"),
      v.literal("critical")
    ),
    status: v.union(
      v.literal("active"),
      v.literal("resolved"),
      v.literal("acknowledged")
    ),
    created_at: v.number(),
    resolved_at: v.optional(v.number()),
    metadata: v.optional(v.any()),
  })
    .index("by_status", ["status", "created_at"])
    .index("by_severity", ["severity", "created_at"]),

  commands: defineTable({
    request_id: v.string(),
    action: v.string(),
    target_type: v.union(
      v.literal("container"),
      v.literal("service"),
      v.literal("agent"),
      v.literal("dokploy-app"),
      v.literal("fail2ban")
    ),
    target_id: v.string(),
    payload: v.optional(v.any()),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("success"),
      v.literal("failed"),
      v.literal("cancelled"),
      v.literal("timeout")
    ),
    requested_by: v.string(),
    requested_at: v.number(),
    started_at: v.optional(v.number()),
    finished_at: v.optional(v.number()),
    result: v.optional(v.string()),
    error: v.optional(v.string()),
  })
    .index("by_status", ["status", "requested_at"])
    .index("by_request_id", ["request_id"]),

  app_status: defineTable({
    name: v.string(),
    source: v.union(
      v.literal("dokploy"),
      v.literal("docker"),
      v.literal("systemd")
    ),
    runtime_status: v.union(
      v.literal("running"),
      v.literal("stopped"),
      v.literal("restarting"),
      v.literal("error"),
      v.literal("unknown")
    ),
    health_status: v.union(
      v.literal("healthy"),
      v.literal("unhealthy"),
      v.literal("none"),
      v.literal("unknown")
    ),
    ports: v.array(
      v.object({
        internal: v.number(),
        published: v.number(),
        protocol: v.string(),
      })
    ),
    domain: v.optional(v.string()),
    last_seen: v.number(),
    restart_count: v.optional(v.number()),
    last_deploy_time: v.optional(v.number()),
    last_known_error: v.optional(v.string()),
    metadata: v.optional(v.any()),
  })
    .index("by_name", ["name"])
    .index("by_source", ["source"])
    .index("by_runtime_status", ["runtime_status"]),
});
