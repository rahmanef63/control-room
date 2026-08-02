import assert from "node:assert/strict";
import { test } from "node:test";

import { isAuthorizedGatewayRequest } from "./auth.js";

function reqWith(secret?: string): Parameters<typeof isAuthorizedGatewayRequest>[0] {
  const headers = secret === undefined ? {} : { "x-control-room-secret": secret };
  return { headers } as unknown as Parameters<typeof isAuthorizedGatewayRequest>[0];
}

test("accepts the matching secret", () => {
  assert.equal(isAuthorizedGatewayRequest(reqWith("s3cret"), "s3cret"), true);
});

test("rejects a wrong secret of equal length", () => {
  assert.equal(isAuthorizedGatewayRequest(reqWith("aaaaaa"), "s3cret"), false);
});

test("rejects a missing header", () => {
  assert.equal(isAuthorizedGatewayRequest(reqWith(undefined), "s3cret"), false);
});

test("rejects when no server secret is configured", () => {
  assert.equal(isAuthorizedGatewayRequest(reqWith("anything"), undefined), false);
});

test("rejects a length-mismatched secret without throwing", () => {
  assert.equal(isAuthorizedGatewayRequest(reqWith("short"), "a-much-longer-secret"), false);
});
