import type { MutationCtx, QueryCtx } from "../_generated/server";
import { appStatusFields } from "../lib/validators";

export interface UpsertAppStatusArgs {
  name: string;
  source: "dokploy" | "docker" | "systemd";
  runtime_status: "running" | "stopped" | "restarting" | "error" | "unknown";
  health_status: "healthy" | "unhealthy" | "none" | "unknown";
  ports: Array<{
    internal: number;
    published: number;
    protocol: string;
  }>;
  domain?: string;
  last_seen: number;
  restart_count?: number;
  last_deploy_time?: number;
  last_known_error?: string;
  metadata?: unknown;
}

export async function upsertAppStatusHandler(
  ctx: MutationCtx,
  args: UpsertAppStatusArgs
) {
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
}

export async function listAppsHandler(ctx: QueryCtx) {
  return await ctx.db.query("app_status").collect();
}
