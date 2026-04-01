import { defineTable } from "convex/server";

import {
  agentStatusFields,
  alertsFields,
  appStatusFields,
  auditLogFields,
  commandsFields,
  eventsFields,
  systemSnapshotFields,
} from "./validators";

export const eventsTable = defineTable(eventsFields)
  .index("by_timestamp", ["timestamp"])
  .index("by_type", ["type", "timestamp"])
  .index("by_severity", ["severity", "timestamp"]);

export const auditLogTable = defineTable(auditLogFields)
  .index("by_timestamp", ["timestamp"])
  .index("by_target", ["target", "timestamp"])
  .index("by_action", ["action", "timestamp"]);

export const agentStatusTable = defineTable(agentStatusFields)
  .index("by_name", ["name"])
  .index("by_status", ["status"]);

export const systemSnapshotTable = defineTable(systemSnapshotFields).index(
  "by_timestamp",
  ["timestamp"]
);

export const alertsTable = defineTable(alertsFields)
  .index("by_status", ["status", "created_at"])
  .index("by_severity", ["severity", "created_at"]);

export const commandsTable = defineTable(commandsFields)
  .index("by_status", ["status", "requested_at"])
  .index("by_request_id", ["request_id"]);

export const appStatusTable = defineTable(appStatusFields)
  .index("by_name", ["name"])
  .index("by_source", ["source"])
  .index("by_runtime_status", ["runtime_status"]);
