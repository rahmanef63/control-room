import { defineSchema } from "convex/server";

import {
  agentStatusTable,
  alertsTable,
  appStatusTable,
  auditLogTable,
  commandsTable,
  eventsTable,
  systemSnapshotTable,
} from "./lib/tables";

export default defineSchema({
  events: eventsTable,
  audit_log: auditLogTable,
  agent_status: agentStatusTable,
  system_snapshot: systemSnapshotTable,
  alerts: alertsTable,
  commands: commandsTable,
  app_status: appStatusTable,
});
