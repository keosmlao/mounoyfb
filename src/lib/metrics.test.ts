import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EMPTY_TOTALS,
  aggregate,
  derive,
  groupTotals,
  sumTotals,
  type Totals,
} from "./metrics";
import { TOTALS_LEVEL, totalsScope } from "./scope";

/**
 * ທຸກຕົວເລກທີ່ຄົນເຫັນຢູ່ໜ້າຈໍຜ່ານໄຟລ໌ນີ້ — ROAS, ຄ່າຕໍ່ຄົນທັກ, ກຳໄລ.
 * ຖ້າມັນຜິດ ຄົນຈະຕັດ ຫຼື ເພີ່ມງົບຈາກເລກຜິດ ແລ້ວເສຍເງິນຈິງ
 * ໂດຍທີ່ບໍ່ມີໜ້າຈໍໃດບອກວ່າມີຫຍັງຜິດ.
 */

function row(patch: Partial<Totals>): Partial<Totals> {
  return patch;
}

test("ບວກທຸກຊ່ອງ ແລະ ຊ່ອງທີ່ບໍ່ມີຖືເປັນສູນ", () => {
  const total = sumTotals([
    row({ spendLak: 100, clicks: 5, messages: 2 }),
    row({ spendLak: 50, impressions: 1000 }),
  ]);
  assert.equal(total.spendLak, 150);
  assert.equal(total.clicks, 5);
  assert.equal(total.messages, 2);
  assert.equal(total.impressions, 1000);
  assert.equal(total.revenue, 0);
});

test("ບໍ່ມີແຖວເລີຍ ໄດ້ສູນທັງໝົດ ບໍ່ແມ່ນ NaN", () => {
  assert.deepEqual(sumTotals([]), EMPTY_TOTALS);
});

test("ບວກແລ້ວບໍ່ໄປແກ້ຄ່າຄົງທີ່ EMPTY_TOTALS", () => {
  // ຖ້າ sumTotals ໃຊ້ EMPTY_TOTALS ໂດຍກົງ ຍອດຈະສະສົມຂ້າມການເອີ້ນ
  sumTotals([row({ spendLak: 999 })]);
  assert.equal(EMPTY_TOTALS.spendLak, 0);
});

test("ຕົວຊີ້ວັດຄິດຈາກຍອດລວມ ບໍ່ແມ່ນຄ່າສະເລ່ຍຂອງອັດຕາລາຍວັນ", () => {
  // ມື້ 1: ເຫັນ 100 ຄັ້ງ ຄລິກ 10 → CTR 10%
  // ມື້ 2: ເຫັນ 9,900 ຄັ້ງ ຄລິກ 90 → CTR ~0.91%
  const days = [
    row({ impressions: 100, clicks: 10 }),
    row({ impressions: 9_900, clicks: 90 }),
  ];

  const correct = aggregate(days).ctr; // 100 / 10,000 = 1%
  const wrongAverage = (10 / 100 + 90 / 9_900) / 2; // ~5.45%

  assert.equal(correct, 0.01);
  // ຄ່າສະເລ່ຍຂອງອັດຕາໃຫ້ຄຳຕອບຜິດເກືອບ 5 ເທົ່າ — ນີ້ຄືເຫດຜົນທີ່ຕ້ອງລວມກ່ອນ
  assert.ok(wrongAverage > correct * 5);
});

test("ROAS ຄິດຈາກຍອດລວມ", () => {
  const d = aggregate([
    row({ spendLak: 1_000_000, revenue: 2_500_000 }),
    row({ spendLak: 1_000_000, revenue: 1_500_000 }),
  ]);
  assert.equal(d.roas, 2); // 4,000,000 ÷ 2,000,000
  assert.equal(d.profit, 2_000_000);
});

test("ຫານດ້ວຍສູນ ຄືນ 0 ບໍ່ແມ່ນ Infinity", () => {
  const d = derive({ ...EMPTY_TOTALS, spendLak: 500_000 });
  assert.equal(d.cpc, 0);
  assert.equal(d.ctr, 0);
  assert.equal(d.costPerMessage, 0);
  assert.equal(d.costPerPurchase, 0);
  assert.equal(d.roas, 0);
  assert.equal(d.frequency, 0);
  assert.equal(d.convRate, 0);
  // ຂາດທຶນເຕັມຈຳນວນ — ບໍ່ແມ່ນ 0
  assert.equal(d.profit, -500_000);
});

test("CPM ຄິດຕໍ່ 1,000 ຄັ້ງທີ່ເຫັນ", () => {
  const d = derive({ ...EMPTY_TOTALS, spendLak: 200_000, impressions: 50_000 });
  assert.equal(d.cpm, 4_000);
});

test("ຄ່າຕໍ່ 1 ຄົນທັກ ແລະ ອັດຕາປິດ", () => {
  const d = derive({
    ...EMPTY_TOTALS,
    spendLak: 1_200_000,
    messages: 40,
    purchases: 10,
  });
  assert.equal(d.costPerMessage, 30_000);
  assert.equal(d.convRate, 0.25);
});

test("ຄວາມຖີ່ = ຄັ້ງທີ່ເຫັນ ÷ ຄົນທີ່ເຂົ້າເຖິງ", () => {
  const d = derive({ ...EMPTY_TOTALS, impressions: 30_000, reach: 10_000 });
  assert.equal(d.frequency, 3);
});

test("ຈັດກຸ່ມແລ້ວລວມແຕ່ລະກຸ່ມແຍກກັນ", () => {
  const rows = [
    { key: "A", spendLak: 100, messages: 1 },
    { key: "B", spendLak: 200, messages: 2 },
    { key: "A", spendLak: 300, messages: 3 },
  ];
  const map = groupTotals(rows, (r) => r.key);
  assert.equal(map.size, 2);
  assert.equal(map.get("A")?.spendLak, 400);
  assert.equal(map.get("A")?.messages, 4);
  assert.equal(map.get("B")?.spendLak, 200);
});

test("ຍອດລວມນັບສະເພາະລະດັບແຄມເປນ", () => {
  // ຕາຕະລາງ Insight ເກັບໄດ້ 3 ລະດັບ — ຖ້າກົດນີ້ປ່ຽນ ຍອດຈະກາຍເປັນ 3 ເທົ່າ
  // ທົ່ວທັງລະບົບ ໂດຍທີ່ບໍ່ມີໜ້າຈໍໃດເຕືອນ
  assert.equal(TOTALS_LEVEL, "CAMPAIGN");
  assert.deepEqual(totalsScope, { level: "CAMPAIGN" });
});
