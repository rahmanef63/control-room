import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import {
  insertEventHandler,
  listEventsHandler,
} from "./domains/events";
import { eventSeverityValidator, eventsFields } from "./lib/validators";

export const insertEvent = mutation({
  args: {
    ...eventsFields,
  },
  handler: insertEventHandler,
});

export const listEvents = query({
  args: {
    paginationOpts: paginationOptsValidator,
    type: v.optional(v.string()),
    severity: v.optional(eventSeverityValidator),
  },
  handler: listEventsHandler,
});
