import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  alertSeverityValidator,
} from "../lib/validators";

export interface UpsertAlertArgs {
  type: string;
  message: string;
  severity: "warning" | "error" | "critical";
  target?: string;
  metadata?: unknown;
}

export interface ResolveAlertArgs {
  id: Id<"alerts">;
}

export interface ResolveAlertByScopeArgs {
  type: string;
  target?: string;
}

export async function upsertAlertHandler(
  ctx: MutationCtx,
  args: UpsertAlertArgs
) {
  const existingAlerts = await ctx.db
    .query("alerts")
    .withIndex("by_type_and_target", (q) =>
      q.eq("type", args.type).eq("target", args.target).eq("status", "active")
    )
    .collect();

  const existing = existingAlerts[0];

  if (existing) {
    await ctx.db.patch(existing._id, {
      message: args.message,
      target: args.target,
      severity: args.severity,
      metadata: args.metadata,
    });
    return existing._id;
  }

  return await ctx.db.insert("alerts", {
    type: args.type,
    message: args.message,
    target: args.target,
    severity: args.severity,
    status: "active",
    created_at: Date.now(),
    metadata: args.metadata,
  });
}

export async function resolveAlertHandler(
  ctx: MutationCtx,
  args: ResolveAlertArgs
) {
  await ctx.db.patch(args.id, {
    status: "resolved",
    resolved_at: Date.now(),
  });
  return args.id;
}

export async function resolveAlertByScopeHandler(
  ctx: MutationCtx,
  args: ResolveAlertByScopeArgs
) {
  const alerts = await ctx.db
    .query("alerts")
    .withIndex("by_type_and_target", (q) =>
      q.eq("type", args.type).eq("target", args.target).eq("status", "active")
    )
    .collect();

  if (alerts.length === 0) {
    return { resolved: 0 };
  }

  const resolvedAt = Date.now();

  await Promise.all(
    alerts.map((alert) =>
      ctx.db.patch(alert._id, {
        status: "resolved",
        resolved_at: resolvedAt,
      })
    )
  );

  return { resolved: alerts.length };
}

export async function listActiveAlertsHandler(ctx: QueryCtx) {
  return await ctx.db
    .query("alerts")
    .withIndex("by_status", (q) => q.eq("status", "active"))
    .order("desc")
    .collect();
}
