import { ManagedAppError } from "./security.js";

const DEFAULT_LIMIT = 12;
const DEFAULT_WINDOW_MS = 60_000;

export class ManagedAppRateLimiter {
  private readonly timestamps = new Map<string, number[]>();

  constructor(
    private readonly limit = DEFAULT_LIMIT,
    private readonly windowMs = DEFAULT_WINDOW_MS,
  ) {}

  consume(key: string, now = Date.now()): void {
    const cutoff = now - this.windowMs;
    const recent = (this.timestamps.get(key) ?? []).filter((timestamp) => timestamp > cutoff);
    if (recent.length >= this.limit) {
      this.timestamps.set(key, recent);
      throw new ManagedAppError("Too many managed application operations", 429);
    }
    recent.push(now);
    this.timestamps.set(key, recent);
  }
}

export function assertManagedAppsWritable(): void {
  const value = process.env.CONTROL_ROOM_DEMO_MODE ?? process.env.PUBLIC_DEMO_MODE ?? "";
  if (["1", "true", "yes", "on"].includes(value.toLowerCase())) {
    throw new ManagedAppError("Managed application actions are disabled in demo mode", 403);
  }
}

export function requestRateLimitKey(remoteAddress: string | undefined): string {
  return remoteAddress?.slice(0, 128) || "local";
}
