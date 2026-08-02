import assert from "node:assert/strict";
import { test } from "node:test";

import { MIN_SECRET_LEN, signSession, verifySession, type SessionPayload } from "./session";

// Must be >= MIN_SECRET_LEN — verifySession now rejects short/empty keys.
const SECRET = "test-secret-value-padded-to-min-length-0123456789";

function freshPayload(): SessionPayload {
  const now = Date.now();
  return { issued_at: now, expires_at: now + 60_000 };
}

test("a freshly signed session round-trips", () => {
  const payload = freshPayload();
  const token = signSession(payload, SECRET);
  assert.deepEqual(verifySession(token, SECRET), payload);
});

test("a wrong secret fails verification", () => {
  const token = signSession(freshPayload(), SECRET);
  assert.equal(verifySession(token, `${SECRET}-but-different`), null);
});

test("a short/empty signing key is rejected (fail-closed)", () => {
  const token = signSession(freshPayload(), SECRET);
  assert.equal(verifySession(token, "x".repeat(MIN_SECRET_LEN - 1)), null);
  assert.equal(verifySession(token, ""), null);
});

test("a tampered payload fails verification", () => {
  const token = signSession(freshPayload(), SECRET);
  const [enc, sig] = token.split(".");
  const flipped = (enc[0] === "A" ? "B" : "A") + enc.slice(1);
  assert.equal(verifySession(`${flipped}.${sig}`, SECRET), null);
});

test("an expired session is rejected", () => {
  const now = Date.now();
  const token = signSession({ issued_at: now - 120_000, expires_at: now - 60_000 }, SECRET);
  assert.equal(verifySession(token, SECRET), null);
});

test("a malformed cookie returns null", () => {
  assert.equal(verifySession("not-a-valid-cookie", SECRET), null);
});
