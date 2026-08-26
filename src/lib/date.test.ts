import assert from "node:assert/strict";
import test from "node:test";
import { chunkRange, countDays, parseDate, toDateInput } from "./date";

test("parseDate keeps @db.Date values at UTC midnight", () => {
  assert.equal(parseDate("2026-08-26").toISOString(), "2026-08-26T00:00:00.000Z");
  assert.equal(toDateInput(parseDate("2026-08-26")), "2026-08-26");
});

test("parseDate rejects malformed and impossible dates", () => {
  assert.throws(() => parseDate("2026-02-30"));
  assert.throws(() => parseDate("26/08/2026"));
});

test("chunkRange creates inclusive seven-day chunks", () => {
  const range = { from: "2026-08-01", to: "2026-08-17" };
  assert.deepEqual(chunkRange(range), [
    { from: "2026-08-01", to: "2026-08-07" },
    { from: "2026-08-08", to: "2026-08-14" },
    { from: "2026-08-15", to: "2026-08-17" },
  ]);
  assert.equal(countDays(range), 17);
});

test("countDays is not truncated for ranges longer than chart limits", () => {
  assert.equal(countDays({ from: "2020-01-01", to: "2021-12-31" }), 731);
});
