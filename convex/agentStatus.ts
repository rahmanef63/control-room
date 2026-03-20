import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const upsertAgentStatus = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("agent_status")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        pid: args.pid,
        status: args.status,
        cpu: args.cpu,
        memory: args.memory,
        uptime_seconds: args.uptime_seconds,
        last_seen: args.last_seen,
        detection_source: args.detection_source,
        available_actions: args.available_actions,
        metadata: args.metadata,
      });
      return existing._id;
    }

    return await ctx.db.insert("agent_status", {
      name: args.name,
      pid: args.pid,
      status: args.status,
      cpu: args.cpu,
      memory: args.memory,
      uptime_seconds: args.uptime_seconds,
      last_seen: args.last_seen,
      detection_source: args.detection_source,
      available_actions: args.available_actions,
      metadata: args.metadata,
    });
  },
});

export const listAgents = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("agent_status").collect();
  },
});
