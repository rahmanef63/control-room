import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  eventSeverityValidator,
  eventsFields,
} from "../lib/validators";

export interface InsertEventArgs {
  timestamp: number;
  type: string;
  message: string;
  severity: "info" | "warning" | "error" | "critical";
  source: string;
  target?: string;
  metadata?: unknown;
}

export interface ListEventsArgs {
  paginationOpts: { cursor: string | null; numItems: number };
  type?: string;
  severity?: "info" | "warning" | "error" | "critical";
}

export async function insertEventHandler(
  ctx: MutationCtx,
  args: InsertEventArgs
) {
  return await ctx.db.insert("events", {
    timestamp: args.timestamp,
    type: args.type,
    message: args.message,
    severity: args.severity,
    source: args.source,
    target: args.target,
    metadata: args.metadata,
  });
}

export async function listEventsHandler(
  ctx: QueryCtx,
  args: ListEventsArgs
) {
  if (args.type !== undefined) {
    const type = args.type;
    return await ctx.db
      .query("events")
      .withIndex("by_type", (q) => q.eq("type", type))
      .order("desc")
      .paginate(args.paginationOpts);
  }

  if (args.severity !== undefined) {
    const severity = args.severity;
    return await ctx.db
      .query("events")
      .withIndex("by_severity", (q) => q.eq("severity", severity))
      .order("desc")
      .paginate(args.paginationOpts);
  }

  return await ctx.db
    .query("events")
    .withIndex("by_timestamp")
    .order("desc")
    .paginate(args.paginationOpts);
}
