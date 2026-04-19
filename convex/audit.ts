import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import {
  insertAuditHandler,
  listAuditLogsHandler,
} from "./domains/audit";
import { auditLogFields } from "./lib/validators";

export const insertAudit = mutation({
  args: {
    ...auditLogFields,
  },
  handler: insertAuditHandler,
});

export const listAuditLogs = query({
  args: {
    paginationOpts: paginationOptsValidator,
    target: v.optional(v.string()),
    action: v.optional(v.string()),
  },
  handler: listAuditLogsHandler,
});
