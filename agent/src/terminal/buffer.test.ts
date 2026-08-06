import assert from "node:assert/strict";
import { test } from "node:test";

import { MAX_BUFFER_CHARS, ScrollbackBuffer } from "./buffer.js";

test("preserves exact content below the cap", () => {
  const buf = new ScrollbackBuffer();
  buf.append("hello ");
  buf.append("world");
  buf.append("\r\n$ ");
  assert.equal(buf.toString(), "hello world\r\n$ ");
});

test("empty buffer joins to an empty string", () => {
  assert.equal(new ScrollbackBuffer().toString(), "");
});

test("keeps exactly the last maxChars characters across many chunks", () => {
  const buf = new ScrollbackBuffer(10);
  for (const chunk of ["abc", "def", "ghi", "jkl"]) {
    buf.append(chunk);
  }
  assert.equal(buf.toString(), "cdefghijkl");
});

test("truncates a single oversized chunk to its tail", () => {
  const buf = new ScrollbackBuffer(5);
  buf.append("0123456789");
  assert.equal(buf.toString(), "56789");
});

test("truncates an oversized chunk appended after existing content", () => {
  const buf = new ScrollbackBuffer(5);
  buf.append("ab");
  buf.append("0123456789");
  assert.equal(buf.toString(), "56789");
});

test("re-reading after an append returns fresh content (cache invalidated)", () => {
  const buf = new ScrollbackBuffer(4);
  buf.append("ab");
  assert.equal(buf.toString(), "ab");
  buf.append("cdef");
  assert.equal(buf.toString(), "cdef");
  assert.equal(buf.toString(), "cdef");
});

test("matches slice() semantics at the real cap", () => {
  const buf = new ScrollbackBuffer();
  let expected = "";
  for (let i = 0; i < 400; i += 1) {
    const chunk = `${i}:`.padEnd(1_000, "x");
    buf.append(chunk);
    expected += chunk;
  }
  expected = expected.slice(expected.length - MAX_BUFFER_CHARS);
  assert.equal(buf.toString().length, MAX_BUFFER_CHARS);
  assert.equal(buf.toString(), expected);
});
