import assert from "node:assert/strict";
import test from "node:test";
import { createSessionToken, timingSafeEqual, verifySessionToken } from "./auth";

test("session tokens verify and reject tampering", async () => {
  const previous = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = "test-secret-that-is-long-enough";
  try {
    const token = await createSessionToken();
    assert.equal(await verifySessionToken(token.value), true);
    assert.equal(await verifySessionToken(`${token.value}x`), false);
  } finally {
    if (previous === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previous;
  }
});

test("timingSafeEqual handles equal, unequal, and different-length strings", () => {
  assert.equal(timingSafeEqual("same", "same"), true);
  assert.equal(timingSafeEqual("same", "diff"), false);
  assert.equal(timingSafeEqual("short", "longer"), false);
});
