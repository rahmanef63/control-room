import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";

import { pathFor, writeJsonState } from "./store.js";

test("builds a json path for a valid key", () => {
  assert.equal(path.basename(pathFor("workspace-state")), "workspace-state.json");
});

test("accepts underscores and digits", () => {
  assert.doesNotThrow(() => pathFor("session_42"));
});

test("rejects path traversal in the key", () => {
  assert.throws(() => pathFor("../../etc/passwd"), /Invalid state key/);
});

test("rejects slashes and dots", () => {
  assert.throws(() => pathFor("a/b"), /Invalid state key/);
  assert.throws(() => pathFor("a.b"), /Invalid state key/);
});

// A dropped request body used to reach writeJsonState as `null` and overwrite
// the stored value with 4 bytes of "null". Absence is a missing file, so an
// empty write is always a bug — never let it touch the disk.
test("refuses to persist null or undefined over existing state", async () => {
  await assert.rejects(() => writeJsonState("workspaces", null), /Refusing to write empty state/);
  await assert.rejects(
    () => writeJsonState("workspaces", undefined),
    /Refusing to write empty state/
  );
});
