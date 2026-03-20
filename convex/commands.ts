import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

export const enqueueCommand = mutation({
  args: {
    action: v.string(),
    target_type: v.union(
      v.literal("container"),
      v.literal("service"),
      v.literal("agent"),
      v.literal("dokploy-app"),
      v.literal("fail2ban")
    ),
    target_id: v.string(),
    payload: v.optional(v.any()),
    requested_by: v.string(),
  },
  handler: async (ctx, args) => {
    const request_id = crypto.randomUUID();
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
  },
});

export const updateCommandStatus = mutation({
  args: {
    id: v.id("commands"),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("success"),
      v.literal("failed"),
      v.literal("cancelled"),
      v.literal("timeout")
    ),
    started_at: v.optional(v.number()),
    finished_at: v.optional(v.number()),
    result: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
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
  },
});

export const pollPendingCommands = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("commands")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .order("asc")
      .take(10);
  },
});

export const listCommands = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("commands")
      .withIndex("by_status")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});
