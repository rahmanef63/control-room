import { ConvexHttpClient } from "convex/browser";
import { config } from "./config.js";
import { logger } from "./logger.js";

let convex_connected = false;

export const convexClient = new ConvexHttpClient(config.CONVEX_URL);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(convexClient as any).setAdminAuth(config.CONVEX_ADMIN_KEY);

export function isConvexConnected(): boolean {
  return convex_connected;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function mutate(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const backoffs = [1000, 2000, 4000];
  let lastError: unknown;

  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (convexClient as any).mutation(name, args);
      convex_connected = true;
      return result;
    } catch (err) {
      lastError = err;
      convex_connected = false;
      const backoff = backoffs[attempt];
      logger.error("Convex mutation failed", {
        name,
        attempt,
        error: String(err),
        retrying: attempt < 2,
      });
      if (attempt < 2 && backoff !== undefined) {
        await sleep(backoff);
      }
    }
  }

  throw lastError;
}

export async function query(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const backoffs = [1000, 2000, 4000];
  let lastError: unknown;

  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (convexClient as any).query(name, args);
      convex_connected = true;
      return result;
    } catch (err) {
      lastError = err;
      convex_connected = false;
      const backoff = backoffs[attempt];
      logger.error("Convex query failed", {
        name,
        attempt,
        error: String(err),
        retrying: attempt < 2,
      });
      if (attempt < 2 && backoff !== undefined) {
        await sleep(backoff);
      }
    }
  }

  throw lastError;
}
