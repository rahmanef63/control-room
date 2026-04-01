import type { QueryCtx, MutationCtx } from "../_generated/server";
import { systemSnapshotFields } from "../lib/validators";

export interface UpsertSystemSnapshotArgs {
  timestamp: number;
  cpu_total: number;
  cpu_cores: number[];
  ram_total: number;
  ram_used: number;
  ram_available: number;
  disk: Array<{
    mount: string;
    total: number;
    used: number;
    available: number;
  }>;
  network: {
    rx_bytes: number;
    tx_bytes: number;
    rx_rate: number;
    tx_rate: number;
  };
  uptime_seconds: number;
  load_average: number[];
}

export async function upsertSystemSnapshotHandler(
  ctx: MutationCtx,
  args: UpsertSystemSnapshotArgs
) {
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
}

export async function getLatestSnapshotHandler(ctx: QueryCtx) {
  return await ctx.db
    .query("system_snapshot")
    .withIndex("by_timestamp")
    .order("desc")
    .first();
}

export async function getOverviewHandler(ctx: QueryCtx) {
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
}
