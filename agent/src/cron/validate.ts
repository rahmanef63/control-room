import { TERMINAL_PROFILES } from "../terminal/profiles.js";
import type { CronAction } from "./types.js";

const VALID_PROFILES = new Set<string>(TERMINAL_PROFILES.map((p) => p.profile));
const MAX_CRON_COMMAND_CHARS = 4_000;

export function validateAction(action: CronAction): void {
  if (!action || typeof action !== "object") {
    throw new Error("Invalid cron action");
  }
  if (action.type === "spawn") {
    if (action.profile !== undefined && !VALID_PROFILES.has(action.profile)) {
      throw new Error(`Unknown terminal profile: ${action.profile}`);
    }
    if (action.initialCommand !== undefined) {
      if (typeof action.initialCommand !== "string") {
        throw new Error("initialCommand must be a string");
      }
      if (action.initialCommand.length > MAX_CRON_COMMAND_CHARS) {
        throw new Error("initialCommand exceeds max length");
      }
    }
    return;
  }
  if (action.type === "send_input") {
    if (!action.sessionId || typeof action.data !== "string") {
      throw new Error("send_input requires sessionId and data");
    }
    if (action.data.length > MAX_CRON_COMMAND_CHARS) {
      throw new Error("send_input data exceeds max length");
    }
    return;
  }
  throw new Error(`Unknown cron action type: ${(action as { type?: string }).type}`);
}
