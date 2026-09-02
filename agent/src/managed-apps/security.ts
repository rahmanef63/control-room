import { MANAGED_APP_ACTIONS, MANAGED_APP_IDS, type ManagedAppAction, type ManagedAppId } from "./types.js";

export class ManagedAppError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export function parseManagedAppId(value: string | undefined): ManagedAppId {
  if (value && (MANAGED_APP_IDS as readonly string[]).includes(value)) return value as ManagedAppId;
  throw new ManagedAppError("Unknown managed application", 404);
}

export function parseManagedAppAction(value: unknown): ManagedAppAction {
  if (typeof value === "string" && (MANAGED_APP_ACTIONS as readonly string[]).includes(value)) {
    return value as ManagedAppAction;
  }
  throw new ManagedAppError("Unsupported managed application action");
}

export function redactManagedAppLog(line: string): string {
  return line
    .replace(/\b(bearer)\s+[a-z0-9._~+\/-]+=*/gi, "$1 [redacted]")
    .replace(/\b(api[_-]?key|token|secret|password|authorization)\b\s*[:=]\s*([^\s,;]+)/gi, "$1=[redacted]")
    .slice(0, 8_192);
}

/** Keep browser-visible errors free of host paths, command output, and secrets. */
export function safeManagedAppError(error: unknown): { status: number; error: string } {
  if (error instanceof ManagedAppError) return { status: error.status, error: error.message };
  return { status: 500, error: "Managed application operation failed" };
}
