import assert from "node:assert/strict";
import test from "node:test";
import {
  consumeRateLimit,
  resetRateLimitsForTests,
  validatePlainText,
} from "./forum.mjs";

test("plain-text validation normalizes line endings and rejects control characters", () => {
  assert.equal(
    validatePlainText("  Array notes\r\nwith measurements.  ", { field: "body", min: 5, max: 100 }),
    "Array notes\nwith measurements.",
  );
  assert.throws(
    () => validatePlainText("unsafe\u0000text", { field: "body", min: 1, max: 100 }),
    error => error.code === "validation_error" && error.status === 422,
  );
});

test("plain-text validation enforces field limits", () => {
  assert.throws(
    () => validatePlainText("short", { field: "title", min: 8, max: 20 }),
    error => error.details.field === "title",
  );
  assert.throws(
    () => validatePlainText("x".repeat(21), { field: "title", min: 8, max: 20 }),
    error => error.details.max === 20,
  );
});

test("per-actor rate limiter is bounded by action and window", () => {
  resetRateLimitsForTests();
  consumeRateLimit("actor-a", "reply", 2, 1000, 1000);
  consumeRateLimit("actor-a", "reply", 2, 1000, 1100);
  assert.throws(
    () => consumeRateLimit("actor-a", "reply", 2, 1000, 1200),
    error => error.code === "rate_limited" && error.status === 429,
  );
  consumeRateLimit("actor-b", "reply", 2, 1000, 1200);
  consumeRateLimit("actor-a", "reply", 2, 1000, 2101);
});
