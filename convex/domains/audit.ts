import { paginationOptsValidator } from "convex/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  auditLogFields,
} from "../lib/validators";
import { v } from "convex/values";

export interface InsertAuditArgs {
  timestamp: number;
  action: string;
  target: string;
  result: "success" | "failed" | "cancelled";
  severity: "info" | "warning" | "critical";
  triggered_by:
    | "manual-dashboard"
    | "manual-cli"
    | "manual-tui"
    | "system-agent"
    | "scheduled-check";
  request_id: string;
  metadata?: unknown;
}

export interface ListAuditLogsArgs {
  paginationOpts: { cursor: string | null; numItems: number };
  target?: string;
  action?: string;
}

export async function insertAuditHandler(
  ctx: MutationCtx,
  args: InsertAuditArgs
) {
  return await ctx.db.insert("audit_log", {
    timestamp: args.timestamp,
    action: args.action,
    target: args.target,
    result: args.result,
    severity: args.severity,
    triggered_by: args.triggered_by,
    request_id: args.request_id,
    metadata: args.metadata,
  });
}

export async function listAuditLogsHandler(
  ctx: QueryCtx,
  args: ListAuditLogsArgs
) {
  if (args.target !== undefined) {
    const target = args.target;
    return await ctx.db
      .query("audit_log")
      .withIndex("by_target", (q) => q.eq("target", target))
      .order("desc")
      .paginate(args.paginationOpts);
  }

  if (args.action !== undefined) {
    const action = args.action;
    return await ctx.db
      .query("audit_log")
      .withIndex("by_action", (q) => q.eq("action", action))
      .order("desc")
      .paginate(args.paginationOpts);
  }

  return await ctx.db
    .query("audit_log")
    .withIndex("by_timestamp")
    .order("desc")
    .paginate(args.paginationOpts);
}
