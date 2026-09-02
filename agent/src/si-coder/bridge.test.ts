import assert from "node:assert/strict";
import { test } from "node:test";

import { callSiCoderTool, listSiCoderTools } from "./bridge.js";

test("SI-Coder discovery exposes only secret-safe sc-agent tools when installed", async () => {
  const surface = await listSiCoderTools();
  if (!surface.installed) return;
  assert.ok(surface.version);
  assert.ok(surface.tools.length > 0);
  assert.equal(surface.tools.some((tool) => tool.name === "sc.verify"), false);
  assert.equal(surface.tools.some((tool) => tool.name === "sc.user.list"), true);
  assert.equal(surface.tools.some((tool) => tool.name === "sc.user.credential.request"), true);
  for (const tool of surface.tools) assert.match(tool.name, /^sc\./);
});


test("executes the installed safe user-list tool through the manifest adapter", async () => {
  const surface = await listSiCoderTools();
  if (!surface.installed) return;
  const response = await callSiCoderTool("sc.user.list", {});
  assert.equal(response.ok, true);
  assert.equal(typeof response.result, "object");
  assert.ok(Array.isArray((response.result as { users?: unknown[] }).users));
});
