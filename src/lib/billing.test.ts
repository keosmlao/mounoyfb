import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildBillingSummary,
  effectiveFxRate,
  FORECAST_DAYS,
  type AccountBilling,
} from "./billing";

/**
 * ໜ້ານີ້ບອກຄົນວ່າ "ຕ້ອງກຽມເງິນເທົ່າໃດ" — ບວກຜິດ ຫຼື ແປງສະກຸນຜິດ
 * ແປວ່າຄົນຈະກຽມເງິນບໍ່ພໍ ແລ້ວໂຄສະນາຖືກປິດກາງທາງ.
 */

const NOW = new Date("2026-08-29T03:00:00.000Z");

function account(over: Partial<AccountBilling> & { id: string }): AccountBilling {
  return {
    name: `ບັນຊີ ${over.id}`,
    currency: "USD",
    fbAccountId: `act_${over.id}`,
    fundingSource: "Mastercard *7447",
    balance: 0,
    amountSpent: 0,
    spendCap: 0,
    billingAt: new Date("2026-08-29T02:00:00.000Z"),
    recentSpendLak: 0,
    recentDays: 7,
    insightSpend: 0,
    insightSpendLak: 0,
    ...over,
  };
}

test("ໃຊ້ອັດຕາທີ່ບັນຊີນັ້ນໃຊ້ຈິງ ບໍ່ແມ່ນອັດຕາທົ່ວໄປ", () => {
  const a = account({ id: "a", insightSpend: 100, insightSpendLak: 2_200_000 });
  assert.equal(effectiveFxRate(a, 21_700), 22_000);
});

test("ບັນຊີໃໝ່ທີ່ຍັງບໍ່ມີຜົນລາຍວັນ ຕົກມາໃຊ້ອັດຕາທົ່ວໄປ", () => {
  assert.equal(effectiveFxRate(account({ id: "a" }), 21_700), 21_700);
});

test("ບັນຊີສະກຸນກີບ ບໍ່ຕ້ອງແປງ", () => {
  const a = account({ id: "a", currency: "LAK", insightSpend: 0 });
  assert.equal(effectiveFxRate(a, 21_700), 1);
});

test("ຈ່າຍແລ້ວ = ໃຊ້ໄປທັງໝົດ − ຄ້າງຊຳລະ", () => {
  const { rows } = buildBillingSummary(
    [account({ id: "a", balance: 40, amountSpent: 1_000 })],
    21_700,
    NOW,
  );
  assert.equal(rows[0].paid, 960);
  assert.equal(rows[0].dueLak, 40 * 21_700);
  assert.equal(rows[0].paidLak, 960 * 21_700);
});

test("ບັນຊີທີ່ຍັງບໍ່ເຄີຍດຶງ ບໍ່ຄິດເປັນເງິນ ແຕ່ຖືກນັບວ່າຂາດຂໍ້ມູນ", () => {
  const s = buildBillingSummary(
    [account({ id: "a", balance: null, amountSpent: null, billingAt: null })],
    21_700,
    NOW,
  );
  assert.equal(s.rows[0].missing, true);
  assert.equal(s.rows[0].paid, null);
  assert.equal(s.dueLak, 0);
  assert.equal(s.missing, 1);
});

test("ບວກຂ້າມບັນຊີໄດ້ຫຼັງແປງເປັນກີບແລ້ວ ເຖິງຄົນລະສະກຸນ", () => {
  const s = buildBillingSummary(
    [
      // USD ອັດຕາຈິງ 22,000
      account({
        id: "usd",
        balance: 50,
        amountSpent: 500,
        insightSpend: 100,
        insightSpendLak: 2_200_000,
      }),
      // ບັນຊີກີບ — ບໍ່ຕ້ອງແປງ
      account({ id: "lak", currency: "LAK", balance: 500_000, amountSpent: 900_000 }),
    ],
    21_700,
    NOW,
  );

  assert.equal(s.dueLak, 50 * 22_000 + 500_000);
  assert.equal(s.owing, 2);
  // ຄ້າງຫຼາຍສຸດຂຶ້ນກ່ອນ
  assert.equal(s.rows[0].id, "usd");
});

test("ຄາດການ 7 ມື້ = ຍອດຄ້າງດຽວນີ້ + ຄ່າສະເລ່ຍຕໍ່ມື້ × 7", () => {
  const { rows } = buildBillingSummary(
    [
      account({
        id: "a",
        balance: 10,
        amountSpent: 100,
        recentSpendLak: 7_000_000,
        recentDays: 7,
      }),
    ],
    21_700,
    NOW,
  );

  assert.equal(rows[0].dailyLak, 1_000_000);
  assert.equal(rows[0].forecast7Lak, 10 * 21_700 + 1_000_000 * FORECAST_DAYS);
});

test("ນັບມື້ທີ່ຈະຮອດເພດານ ຈາກຍອດສະສົມ ບໍ່ແມ່ນຍອດຄ້າງ", () => {
  const { rows } = buildBillingSummary(
    [
      account({
        id: "a",
        balance: 10,
        amountSpent: 900,
        spendCap: 1_000, // ເຫຼືອ $100 = 2,170,000 ກີບ
        recentSpendLak: 7_000_000, // ມື້ລະ 1,000,000
        recentDays: 7,
      }),
    ],
    21_700,
    NOW,
  );
  assert.equal(rows[0].daysToCap, 2);
});

test("ບໍ່ໄດ້ຕັ້ງເພດານ = ບໍ່ຕ້ອງເຕືອນເລື່ອງເພດານ", () => {
  const { rows } = buildBillingSummary(
    [account({ id: "a", spendCap: 0, recentSpendLak: 7_000_000 })],
    21_700,
    NOW,
  );
  assert.equal(rows[0].daysToCap, null);
});

test("ຂໍ້ມູນທີ່ດຶງມາເກີນ 24 ຊົ່ວໂມງ ຖືວ່າເກົ່າ", () => {
  const { rows } = buildBillingSummary(
    [
      account({ id: "ໃໝ່", billingAt: new Date("2026-08-29T01:00:00.000Z") }),
      account({ id: "ເກົ່າ", billingAt: new Date("2026-08-27T01:00:00.000Z") }),
    ],
    21_700,
    NOW,
  );
  assert.equal(rows.find((r) => r.id === "ໃໝ່")!.stale, false);
  assert.equal(rows.find((r) => r.id === "ເກົ່າ")!.stale, true);
});

test("ຍອດຄ້າງຕິດລົບ (ມີເງິນເຫຼືອ) ບໍ່ນັບເປັນໜີ້", () => {
  const s = buildBillingSummary(
    [account({ id: "a", balance: -25, amountSpent: 100 })],
    21_700,
    NOW,
  );
  assert.equal(s.dueLak, 0);
  assert.equal(s.owing, 0);
});

test("ບັນຊີທີ່ຍັງບໍ່ເຄີຍດຶງ ບໍ່ເອົາມາຄາດການ — ບໍ່ດັ່ງນັ້ນຕົວເລກລວມຈະຂາດຄ່າຄ້າງເກົ່າ", () => {
  const s = buildBillingSummary(
    [
      account({
        id: "a",
        balance: null,
        amountSpent: null,
        billingAt: null,
        recentSpendLak: 7_000_000,
      }),
    ],
    21_700,
    NOW,
  );
  assert.equal(s.rows[0].dailyLak, 1_000_000); // ຍັງບອກໄດ້ວ່າໃຊ້ມື້ລະເທົ່າໃດ
  assert.equal(s.rows[0].forecast7Lak, 0); // ແຕ່ຄາດການບໍ່ໄດ້
  assert.equal(s.forecast7Lak, 0);
});
