/**
 * Stub for the Convex generated API types.
 * Run `npx convex dev` (or `npx convex deploy`) from the convex/ directory to
 * regenerate this file with full static types for your deployment.
 *
 * `anyApi` is a runtime Proxy provided by Convex that resolves any property
 * path into a FunctionReference — so `api.snapshots.getOverview` returns a
 * reference the React hooks can use immediately, even before codegen runs.
 */
import { anyApi } from 'convex/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

interface ConvexAPI {
  snapshots: {
    getLatestSnapshot: AnyFn;
    getOverview: AnyFn;
    upsertSystemSnapshot: AnyFn;
  };
  appStatus: {
    listApps: AnyFn;
    upsertAppStatus: AnyFn;
  };
  agentStatus: {
    listAgents: AnyFn;
    upsertAgentStatus: AnyFn;
  };
  alerts: {
    listActiveAlerts: AnyFn;
    upsertAlert: AnyFn;
    resolveAlert: AnyFn;
  };
  events: {
    listEvents: AnyFn;
    insertEvent: AnyFn;
  };
  audit: {
    listAuditLogs: AnyFn;
    insertAudit: AnyFn;
  };
  commands: {
    listCommands: AnyFn;
    enqueueCommand: AnyFn;
    updateCommandStatus: AnyFn;
    pollPendingCommands: AnyFn;
  };
}

export const api = anyApi as unknown as ConvexAPI;
