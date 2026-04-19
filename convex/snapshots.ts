import { mutation, query } from "./_generated/server";
import {
  getLatestSnapshotHandler,
  getOverviewHandler,
  upsertSystemSnapshotHandler,
} from "./domains/snapshots";
import { systemSnapshotFields } from "./lib/validators";

export const upsertSystemSnapshot = mutation({
  args: {
    ...systemSnapshotFields,
  },
  handler: upsertSystemSnapshotHandler,
});

export const getLatestSnapshot = query({
  args: {},
  handler: getLatestSnapshotHandler,
});

export const getOverview = query({
  args: {},
  handler: getOverviewHandler,
});
