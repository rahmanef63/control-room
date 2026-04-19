import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  listActiveAlertsHandler,
  resolveAlertHandler,
  resolveAlertByScopeHandler,
  upsertAlertHandler,
} from "./domains/alerts";
import { alertSeverityValidator } from "./lib/validators";

export const upsertAlert = mutation({
  args: {
    type: v.string(),
    message: v.string(),
    severity: alertSeverityValidator,
    target: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: upsertAlertHandler,
});

export const resolveAlert = mutation({
  args: {
    id: v.id("alerts"),
  },
  handler: resolveAlertHandler,
});

export const resolveAlertByScope = mutation({
  args: {
    type: v.string(),
    target: v.optional(v.string()),
  },
  handler: resolveAlertByScopeHandler,
});

export const listActiveAlerts = query({
  args: {},
  handler: listActiveAlertsHandler,
});
