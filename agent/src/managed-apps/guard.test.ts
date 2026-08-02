import assert from "node:assert/strict";
import { test } from "node:test";

import { ManagedAppRateLimiter, assertManagedAppsWritable, requestRateLimitKey } from "./guard.js";

test("rate limiter rejects excessive lifecycle operations within its window", () => {
  const limiter = new ManagedAppRateLimiter(2, 1_000);
  limiter.consume("owner", 1_000);
  limiter.consume("owner", 1_001);
  assert.throws(() => limiter.consume("owner", 1_002), (error: unknown) => {
    return error instanceof Error && error.message.includes("Too many");
  });
  assert.doesNotThrow(() => limiter.consume("owner", 2_001));
});

test("demo mode blocks destructive managed application actions", () => {
  const previous = process.env.CONTROL_ROOM_DEMO_MODE;
  process.env.CONTROL_ROOM_DEMO_MODE = "true";
  try {
    assert.throws(() => assertManagedAppsWritable(), /disabled in demo mode/);
  } finally {
    if (previous === undefined) delete process.env.CONTROL_ROOM_DEMO_MODE;
    else process.env.CONTROL_ROOM_DEMO_MODE = previous;
  }
});

test("rate limit keys are bounded and have a local fallback", () => {
  assert.equal(requestRateLimitKey(undefined), "local");
  assert.equal(requestRateLimitKey("x".repeat(500)).length, 128);
});
