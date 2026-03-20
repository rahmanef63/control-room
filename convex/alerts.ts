import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const upsertAlert = mutation({
  args: {
    type: v.string(),
    message: v.string(),
    severity: v.union(
      v.literal("warning"),
      v.literal("error"),
      v.literal("critical")
    ),
    target: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Check if an active alert with the same type (and optionally target) exists
    const existingAlerts = await ctx.db
      .query("alerts")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    const existing = existingAlerts.find((alert) => {
      if (alert.type !== args.type) return false;
      if (args.target !== undefined) {
        return alert.metadata?.target === args.target;
      }
      return true;
    });

    if (existing) {
      await ctx.db.patch(existing._id, {
        message: args.message,
        severity: args.severity,
        metadata: args.metadata,
      });
      return existing._id;
    }

    return await ctx.db.insert("alerts", {
      type: args.type,
      message: args.message,
      severity: args.severity,
      status: "active",
      created_at: Date.now(),
      metadata: args.metadata,
    });
  },
});

export const resolveAlert = mutation({
  args: {
    id: v.id("alerts"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "resolved",
      resolved_at: Date.now(),
    });
    return args.id;
  },
});

export const listActiveAlerts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("alerts")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .order("desc")
      .collect();
  },
});
