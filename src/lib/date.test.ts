import assert from "node:assert/strict";
import test from "node:test";
import {
  chunkRange,
  countDays,
  formatAgo,
  laoDay,
  laoDayStart,
  laoHour,
  laoWeekday,
  parseDate,
  toDateInput,
} from "./date";

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

test("formatAgo ນັບຖອຍຫຼັງຕາມໜ່ວຍທີ່ອ່ານງ່າຍ", () => {
  const now = new Date("2026-08-27T10:00:00.000Z");
  const ago = (minutes: number) =>
    formatAgo(new Date(now.getTime() - minutes * 60_000), now);

  assert.equal(ago(0), "ຫາກໍ່ນີ້");
  assert.equal(ago(5), "5 ນາທີກ່ອນ");
  assert.equal(ago(60), "1 ຊົ່ວໂມງກ່ອນ");
  assert.equal(ago(60 * 30), "1 ວັນກ່ອນ");
  // ເກີນ 7 ວັນ ປ່ຽນເປັນວັນທີ່ຈິງ ເພາະ "40 ວັນກ່ອນ" ບໍ່ຊ່ວຍຫຍັງ
  assert.match(ago(60 * 24 * 40), /^\d{2}\/\d{2} \d{2}:\d{2}$/);
});

test("ເວລາຈິງແປງເປັນຊົ່ວໂມງ/ວັນຕາມເວລາລາວ (UTC+7)", () => {
  // 17:00Z ຂອງວັນພະຫັດ = 00:00 ຂອງວັນສຸກ ຕາມເວລາລາວ
  const t = new Date("2026-08-20T17:00:00.000Z");
  assert.equal(laoHour(t), 0);
  assert.equal(laoWeekday(t), 5);
  assert.equal(laoDay(t), "2026-08-21");
});

test("ຕົ້ນວັນລາວເລີ່ມກ່ອນ 00:00Z ຢູ່ 7 ຊົ່ວໂມງ", () => {
  assert.equal(
    laoDayStart("2026-08-21").toISOString(),
    "2026-08-20T17:00:00.000Z",
  );
});
