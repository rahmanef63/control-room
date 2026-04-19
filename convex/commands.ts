import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import {
  enqueueCommandHandler,
  getCommandByRequestIdHandler,
  listCommandsHandler,
  pollPendingCommandsHandler,
  updateCommandStatusHandler,
} from "./domains/commands";
import {
  commandStatusValidator,
  commandTargetTypeValidator,
  commandsFields,
} from "./lib/validators";

export const enqueueCommand = mutation({
  args: {
    action: commandsFields.action,
    target_type: commandTargetTypeValidator,
    target_id: commandsFields.target_id,
    payload: commandsFields.payload,
    requested_by: commandsFields.requested_by,
  },
  handler: enqueueCommandHandler,
});

export const updateCommandStatus = mutation({
  args: {
    id: v.id("commands"),
    status: commandStatusValidator,
    started_at: v.optional(v.number()),
    finished_at: v.optional(v.number()),
    result: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: updateCommandStatusHandler,
});

export const pollPendingCommands = query({
  args: {},
  handler: pollPendingCommandsHandler,
});

export const listCommands = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: listCommandsHandler,
});

export const getCommandByRequestId = query({
  args: {
    request_id: commandsFields.request_id,
  },
  handler: getCommandByRequestIdHandler,
});
