import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  commandsFields,
  commandStatusValidator,
  commandTargetTypeValidator,
} from "../lib/validators";

export interface EnqueueCommandArgs {
  action: string;
  target_type: "container" | "service" | "agent" | "dokploy-app" | "fail2ban";
  target_id: string;
  payload?: unknown;
  requested_by: string;
}

export interface UpdateCommandStatusArgs {
  id: Id<"commands">;
  status: "queued" | "running" | "success" | "failed" | "cancelled" | "timeout";
  started_at?: number;
  finished_at?: number;
  result?: string;
  error?: string;
}

export async function enqueueCommandHandler(
  ctx: MutationCtx,
  args: EnqueueCommandArgs
) {
  const request_id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const requested_at = Date.now();

  return await ctx.db.insert("commands", {
    request_id,
    action: args.action,
    target_type: args.target_type,
    target_id: args.target_id,
    payload: args.payload,
    status: "queued",
    requested_by: args.requested_by,
    requested_at,
  });
}

export async function updateCommandStatusHandler(
  ctx: MutationCtx,
  args: UpdateCommandStatusArgs
) {
  const { id, ...fields } = args;

  const patch: Record<string, unknown> = { status: fields.status };

  if (fields.started_at !== undefined) {
    patch.started_at = fields.started_at;
  }
  if (fields.finished_at !== undefined) {
    patch.finished_at = fields.finished_at;
  }
  if (fields.result !== undefined) {
    patch.result = fields.result;
  }
  if (fields.error !== undefined) {
    patch.error = fields.error;
  }

  await ctx.db.patch(id, patch);
  return id;
}

export async function pollPendingCommandsHandler(ctx: QueryCtx) {
  return await ctx.db
    .query("commands")
    .withIndex("by_status", (q) => q.eq("status", "queued"))
    .order("asc")
    .take(10);
}

export async function listCommandsHandler(
  ctx: QueryCtx,
  args: { paginationOpts: { cursor: string | null; numItems: number } }
) {
  return await ctx.db
    .query("commands")
    .withIndex("by_status")
    .order("desc")
    .paginate(args.paginationOpts);
}
