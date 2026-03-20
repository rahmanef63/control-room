import { internalMutation } from "./_generated/server";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const BATCH_SIZE = 100;

export const cleanupOldEvents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - THIRTY_DAYS_MS;

    const oldEvents = await ctx.db
      .query("events")
      .withIndex("by_timestamp", (q) => q.lt("timestamp", cutoff))
      .take(BATCH_SIZE);

    await Promise.all(oldEvents.map((event) => ctx.db.delete(event._id)));

    return { deleted: oldEvents.length };
  },
});

export const cleanupOldSnapshots = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - SEVEN_DAYS_MS;

    const oldSnapshots = await ctx.db
      .query("system_snapshot")
      .withIndex("by_timestamp", (q) => q.lt("timestamp", cutoff))
      .take(BATCH_SIZE);

    await Promise.all(
      oldSnapshots.map((snapshot) => ctx.db.delete(snapshot._id))
    );

    return { deleted: oldSnapshots.length };
  },
});
