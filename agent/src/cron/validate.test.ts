import assert from "node:assert/strict";
import { test } from "node:test";

import { validateAction } from "./validate.js";

test("accepts a known spawn profile", () => {
  assert.doesNotThrow(() => validateAction({ type: "spawn", profile: "claude" }));
});

test("accepts spawn without a profile", () => {
  assert.doesNotThrow(() => validateAction({ type: "spawn" }));
});

test("rejects an unknown spawn profile", () => {
  assert.throws(() => validateAction({ type: "spawn", profile: "rm-rf" }), /Unknown terminal profile/);
});

test("rejects an over-long initialCommand", () => {
  assert.throws(
    () => validateAction({ type: "spawn", initialCommand: "x".repeat(4_001) }),
    /max length/
  );
});

test("send_input requires sessionId and data", () => {
  assert.throws(() => validateAction({ type: "send_input" } as never), /requires sessionId and data/);
});

test("rejects an over-long send_input payload", () => {
  assert.throws(
    () => validateAction({ type: "send_input", sessionId: "s", data: "x".repeat(4_001) }),
    /max length/
  );
});

test("rejects an unknown action type", () => {
  assert.throws(() => validateAction({ type: "nope" } as never), /Unknown cron action type/);
});
