import test from "node:test";
import assert from "node:assert/strict";
import { ACCOUNT_RETENTION_DAYS, retentionDeadline } from "../src/lib/account-retention-policy";

test("account deletion retention is exactly 90 days", () => {
  const requestedAt = new Date("2026-09-16T12:00:00.000Z");
  const deadline = retentionDeadline(requestedAt);

  assert.equal(ACCOUNT_RETENTION_DAYS, 90);
  assert.equal(deadline.toISOString(), "2026-12-15T12:00:00.000Z");
});

test("retention deadline does not mutate the request timestamp", () => {
  const requestedAt = new Date("2026-01-01T00:00:00.000Z");
  retentionDeadline(requestedAt);
  assert.equal(requestedAt.toISOString(), "2026-01-01T00:00:00.000Z");
});
