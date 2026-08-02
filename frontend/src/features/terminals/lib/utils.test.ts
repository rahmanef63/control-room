import assert from "node:assert/strict";
import { test } from "node:test";

import {
  clampFontSize,
  DEFAULT_FONT_SIZE,
  detectIdleActivity,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  shortenCwd,
  TERMINAL_SCROLLBACK,
} from "./utils";

test("clampFontSize clamps to bounds and rounds", () => {
  assert.equal(clampFontSize(100), MAX_FONT_SIZE);
  assert.equal(clampFontSize(1), MIN_FONT_SIZE);
  assert.equal(clampFontSize(13.4), 13);
  assert.equal(clampFontSize(Number.NaN), DEFAULT_FONT_SIZE);
});

test("TERMINAL_SCROLLBACK stays bounded for memory", () => {
  assert.ok(TERMINAL_SCROLLBACK > 0 && TERMINAL_SCROLLBACK <= 2000);
});

test("detectIdleActivity flags an empty buffer as waiting", () => {
  assert.equal(detectIdleActivity(""), "waiting");
});

test("detectIdleActivity detects a confirmation prompt", () => {
  assert.equal(detectIdleActivity("apply these changes? (y/n)"), "asking");
});

test("detectIdleActivity detects planning", () => {
  assert.equal(detectIdleActivity("Here is my plan:\n1. do x"), "planning");
});

test("shortenCwd collapses the home prefix", () => {
  assert.equal(shortenCwd("/home/user/projects"), "~/projects");
  assert.equal(shortenCwd(""), "~");
});
