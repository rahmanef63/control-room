import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const upsertAppStatus = mutation({
  args: {
    name: v.string(),
    source: v.union(
      v.literal("dokploy"),
      v.literal("docker"),
      v.literal("systemd")
    ),
    runtime_status: v.union(
      v.literal("running"),
      v.literal("stopped"),
      v.literal("restarting"),
      v.literal("error"),
      v.literal("unknown")
    ),
    health_status: v.union(
      v.literal("healthy"),
      v.literal("unhealthy"),
      v.literal("none"),
      v.literal("unknown")
    ),
    ports: v.array(
      v.object({
        internal: v.number(),
        published: v.number(),
        protocol: v.string(),
      })
    ),
    domain: v.optional(v.string()),
    last_seen: v.number(),
    restart_count: v.optional(v.number()),
    last_deploy_time: v.optional(v.number()),
    last_known_error: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("app_status")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        source: args.source,
        runtime_status: args.runtime_status,
        health_status: args.health_status,
        ports: args.ports,
        domain: args.domain,
        last_seen: args.last_seen,
        restart_count: args.restart_count,
        last_deploy_time: args.last_deploy_time,
        last_known_error: args.last_known_error,
        metadata: args.metadata,
      });
      return existing._id;
    }

    return await ctx.db.insert("app_status", {
      name: args.name,
      source: args.source,
      runtime_status: args.runtime_status,
      health_status: args.health_status,
      ports: args.ports,
      domain: args.domain,
      last_seen: args.last_seen,
      restart_count: args.restart_count,
      last_deploy_time: args.last_deploy_time,
      last_known_error: args.last_known_error,
      metadata: args.metadata,
    });
  },
});

export const listApps = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("app_status").collect();
  },
});
