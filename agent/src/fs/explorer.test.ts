import assert from "node:assert/strict";
import { test } from "node:test";

import { isUnderRoot } from "./explorer.js";

test("a path inside the root is allowed", () => {
  assert.equal(isUnderRoot("/home/u/projects/app", "/home/u/projects"), true);
});

test("the root itself is allowed", () => {
  assert.equal(isUnderRoot("/home/u/projects", "/home/u/projects"), true);
});

test("a sibling directory is rejected", () => {
  assert.equal(isUnderRoot("/home/u/secrets", "/home/u/projects"), false);
});

test("a parent traversal is rejected", () => {
  assert.equal(isUnderRoot("/home", "/home/u/projects"), false);
});

test("a path that only shares a string prefix is rejected", () => {
  assert.equal(isUnderRoot("/home/u/projects-evil", "/home/u/projects"), false);
});
