import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { sanitizeDirSegment, uploadDirFor } from "./http.js";

test("sanitizeDirSegment can never escape its parent dir", () => {
  for (const raw of ["../../etc/passwd", "..", "foo/bar", "a/../../b", ".hidden"]) {
    const seg = sanitizeDirSegment(raw);
    assert.ok(!seg.includes("/"), `segment has slash: ${seg}`);
    assert.ok(!seg.includes(".."), `segment has traversal: ${seg}`);
  }
});

test("sanitizeDirSegment falls back when empty after stripping", () => {
  assert.equal(sanitizeDirSegment(""), "terminal");
  assert.equal(sanitizeDirSegment("..."), "terminal");
});

test("sanitizeDirSegment keeps a readable, shell-friendly title", () => {
  assert.equal(sanitizeDirSegment("Empty Terminal"), "Empty-Terminal");
});

test("uploadDirFor names the dir <date>_<title>_<sid> under ~/.os/uploads", () => {
  const dir = uploadDirFor({
    id: "f7c1e726-3e62-479f-a0c9-faf33c1b21e0",
    title: "animation",
    created_at: Date.UTC(2026, 5, 23, 14, 0, 0), // 2026-06-23
  });
  assert.equal(dir, path.join(os.homedir(), ".os", "uploads", "2026-06-23_animation_f7c1e726"));
});

test("uploadDirFor stays under the uploads root even for a hostile title", () => {
  const dir = uploadDirFor({
    id: "../../../../evil",
    title: "../../etc/passwd",
    created_at: 0,
  });
  assert.ok(
    dir.startsWith(path.join(os.homedir(), ".os", "uploads") + path.sep),
    `escaped uploads root: ${dir}`
  );
});
