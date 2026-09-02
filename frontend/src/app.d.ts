import type { SessionPayload } from '$lib/server/session';

declare global {
  namespace App {
    interface Locals {
      /** Set by hooks.server.ts once the signed session cookie verifies. */
      session: SessionPayload | null;
      /** Per-request correlation id returned to the client as X-Request-Id. */
      requestId: string;
    }
  }
}

export {};
