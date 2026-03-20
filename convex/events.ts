import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

export const insertEvent = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("events", {
      timestamp: args.timestamp,
      type: args.type,
      message: args.message,
      severity: args.severity,
      source: args.source,
      target: args.target,
      metadata: args.metadata,
    });
  },
});

export const listEvents = query({
  args: {
    paginationOpts: paginationOptsValidator,
    type: v.optional(v.string()),
    severity: v.optional(
      v.union(
        v.literal("info"),
        v.literal("warning"),
        v.literal("error"),
        v.literal("critical")
      )
    ),
  },
  handler: async (ctx, args) => {
    if (args.type !== undefined) {
      return await ctx.db
        .query("events")
        .withIndex("by_type", (q) => q.eq("type", args.type!))
        .order("desc")
        .paginate(args.paginationOpts);
    }

    if (args.severity !== undefined) {
      return await ctx.db
        .query("events")
        .withIndex("by_severity", (q) => q.eq("severity", args.severity!))
        .order("desc")
        .paginate(args.paginationOpts);
    }

    return await ctx.db
      .query("events")
      .withIndex("by_timestamp")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});
