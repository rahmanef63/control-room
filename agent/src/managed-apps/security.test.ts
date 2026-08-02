import assert from "node:assert/strict";
import { test } from "node:test";

import { isManagedAppAction, ManagedAppRegistry } from "./registry.js";
import { parseManagedAppAction, parseManagedAppId, redactManagedAppLog, safeManagedAppError } from "./security.js";
import type { ManagedAppInstallation } from "./types.js";

test("managed apps accepts only registered application IDs", () => {
  assert.equal(parseManagedAppId("hermes"), "hermes");
  assert.throws(() => parseManagedAppId("hermes; rm -rf /"), /Unknown managed application/);
});

test("managed apps action allowlist rejects command-shaped input", () => {
  assert.equal(parseManagedAppAction("restart"), "restart");
  assert.equal(isManagedAppAction("restart"), true);
  assert.equal(isManagedAppAction("systemctl restart hermes"), false);
  assert.throws(() => parseManagedAppAction("systemctl restart hermes"), /Unsupported/);
});

test("per-application operation lock rejects concurrent lifecycle requests", async () => {
  const registry = new ManagedAppRegistry();
  const lock = (registry as unknown as { activeOperations: Map<string, string> }).activeOperations;
  lock.set("hermes", "update");
  await assert.rejects(registry.act("hermes", "restart", undefined), /already running/);
});

test("managed application logs redact common credential forms", () => {
  const value = redactManagedAppLog("token=abc123 Authorization: Bearer secret-value password=hunter2");
  assert.equal(value.includes("abc123"), false);
  assert.equal(value.includes("secret-value"), false);
  assert.equal(value.includes("hunter2"), false);
});

test("public installation metadata is intentionally not an API shape", () => {
  const internal: ManagedAppInstallation = { id: "hermes", installationType: "systemd", serviceName: "private.service", dataPaths: ["/home/private/.hermes"], configPaths: ["/home/private/.hermes/config"], updateChannel: "stable", detectedAt: 1 };
  assert.ok(internal.dataPaths[0].startsWith("/"));
  const safe = safeManagedAppError(new Error("/home/private/.hermes/token=secret"));
  assert.deepEqual(safe, { status: 500, error: "Managed application operation failed" });
});
