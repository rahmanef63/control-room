import { internalMutation } from "./_generated/server";
import {
  cleanupOldEventsHandler,
  cleanupOldSnapshotsHandler,
} from "./domains/cron-handlers";

export const cleanupOldEvents = internalMutation({
  args: {},
  handler: cleanupOldEventsHandler,
});

export const cleanupOldSnapshots = internalMutation({
  args: {},
  handler: cleanupOldSnapshotsHandler,
});
