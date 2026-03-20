import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const upsertSystemSnapshot = mutation({
  args: {
    timestamp: v.number(),
    cpu_total: v.number(),
    cpu_cores: v.array(v.number()),
    ram_total: v.number(),
    ram_used: v.number(),
    ram_available: v.number(),
    disk: v.array(
      v.object({
        mount: v.string(),
        total: v.number(),
        used: v.number(),
        available: v.number(),
      })
    ),
    network: v.object({
      rx_bytes: v.number(),
      tx_bytes: v.number(),
      rx_rate: v.number(),
      tx_rate: v.number(),
    }),
    uptime_seconds: v.number(),
    load_average: v.array(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("system_snapshot", {
      timestamp: args.timestamp,
      cpu_total: args.cpu_total,
      cpu_cores: args.cpu_cores,
      ram_total: args.ram_total,
      ram_used: args.ram_used,
      ram_available: args.ram_available,
      disk: args.disk,
      network: args.network,
      uptime_seconds: args.uptime_seconds,
      load_average: args.load_average,
    });
  },
});

export const getLatestSnapshot = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("system_snapshot")
      .withIndex("by_timestamp")
      .order("desc")
      .first();
  },
});

export const getOverview = query({
  args: {},
  handler: async (ctx) => {
    const latestSnapshot = await ctx.db
      .query("system_snapshot")
      .withIndex("by_timestamp")
      .order("desc")
      .first();

    const activeAlerts = await ctx.db
      .query("alerts")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    const apps = await ctx.db.query("app_status").collect();

    const agents = await ctx.db.query("agent_status").collect();

    return {
      snapshot: latestSnapshot,
      active_alert_count: activeAlerts.length,
      app_count: apps.length,
      agent_count: agents.length,
    };
  },
});
