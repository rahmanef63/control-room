import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

export const insertAudit = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
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
  },
});

export const listAuditLogs = query({
  args: {
    paginationOpts: paginationOptsValidator,
    target: v.optional(v.string()),
    action: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.target !== undefined) {
      return await ctx.db
        .query("audit_log")
        .withIndex("by_target", (q) => q.eq("target", args.target!))
        .order("desc")
        .paginate(args.paginationOpts);
    }

    if (args.action !== undefined) {
      return await ctx.db
        .query("audit_log")
        .withIndex("by_action", (q) => q.eq("action", args.action!))
        .order("desc")
        .paginate(args.paginationOpts);
    }

    return await ctx.db
      .query("audit_log")
      .withIndex("by_timestamp")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});
