/**
 * This file is a stub for the Convex generated API types.
 * Run `npx convex dev` from the project root to regenerate it with full types.
 * The Convex CLI will replace this file when you connect to your Convex deployment.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQuery = (...args: any[]) => any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMutation = (...args: any[]) => any;

interface ConvexAPI {
  snapshots: {
    getLatestSnapshot: AnyQuery;
    getOverview: AnyQuery;
    upsertSystemSnapshot: AnyMutation;
  };
  appStatus: {
    listApps: AnyQuery;
    upsertAppStatus: AnyMutation;
  };
  agentStatus: {
    listAgents: AnyQuery;
    upsertAgentStatus: AnyMutation;
  };
  alerts: {
    listActiveAlerts: AnyQuery;
    upsertAlert: AnyMutation;
    resolveAlert: AnyMutation;
  };
  events: {
    listEvents: AnyQuery;
    insertEvent: AnyMutation;
  };
  audit: {
    listAuditLogs: AnyQuery;
    insertAudit: AnyMutation;
  };
  commands: {
    listCommands: AnyQuery;
    enqueueCommand: AnyMutation;
    updateCommandStatus: AnyMutation;
    pollPendingCommands: AnyQuery;
  };
}

export declare const api: ConvexAPI;
