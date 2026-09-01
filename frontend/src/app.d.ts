import type { SessionPayload } from '$lib/server/session';

// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
  namespace App {
    interface Locals {
      /** Set by hooks.server.ts once the signed session cookie verifies. */
      session: SessionPayload | null;
    }
    // interface Error {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
