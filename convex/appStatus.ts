import { mutation, query } from "./_generated/server";
import { appStatusFields } from "./lib/validators";
import {
  listAppsHandler,
  upsertAppStatusHandler,
} from "./domains/app-status";

export const upsertAppStatus = mutation({
  args: {
    ...appStatusFields,
  },
  handler: upsertAppStatusHandler,
});

export const listApps = query({
  args: {},
  handler: listAppsHandler,
});
