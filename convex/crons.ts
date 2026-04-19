import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.hourly(
  "cleanupOldEvents",
  { minuteUTC: 0 },
  internal.cronHandlers.cleanupOldEvents
);

crons.hourly(
  "cleanupOldSnapshots",
  { minuteUTC: 5 },
  internal.cronHandlers.cleanupOldSnapshots
);

export default crons;
