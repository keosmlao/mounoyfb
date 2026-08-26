import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MIN_MESSAGES_ABS,
  MIN_SPEND_LAK,
  trustedBad,
  trustedGood,
  type SegmentReport,
  type SegmentRow,
} from "./analysis";
import { makeMoney } from "./money";
import { segmentLabel } from "./segments";

/**
 * ເກນຄວາມໜ້າເຊື່ອຖືຄືສິ່ງທີ່ກັນລະບົບບໍ່ໃຫ້ແນະນຳຈາກຂໍ້ມູນບາງໆ.
 * ຖ້າສ່ວນນີ້ພັງ ຄົນຈະເອົາເງິນຈິງໄປລົງຕາມຄຳແນະນຳທີ່ຜິດ.
 */

function row(over: Partial<SegmentRow>): SegmentRow {
  return {
    segKey: "x",
    label: "x",
    spendLak: 0,
    spendShare: 0,
    messageShare: 0,
    costIndex: 1,
    impressions: 0,
    reach: 0,
    clicks: 0,
    linkClicks: 0,
    messages: 0,
    leadsCount: 0,
    purchases: 0,
    revenue: 0,
    videoViews: 0,
    ctr: 0,
    cpc: 0,
    cpm: 0,
    costPerMessage: 0,
    costPerLead: 0,
    costPerPurchase: 0,
    roas: 0,
    profit: 0,
    frequency: 0,
    convRate: 0,
    ...over,
  } as SegmentRow;
}

function report(rows: SegmentRow[], totalMessages: number): SegmentReport {
  return {
    def: { kind: "PLATFORM" } as SegmentReport["def"],
    total: row({ messages: totalMessages }),
    rows,
  };
}

test("ກຸ່ມທີ່ຄົນທັກໜ້ອຍ ບໍ່ຖືກເອົາໄປແນະນຳວ່າ 'ດີ'", () => {
  const thin = row({ segKey: "thin", messages: MIN_MESSAGES_ABS - 1 });
  const solid = row({ segKey: "solid", messages: 50 });
  const good = trustedGood(report([thin, solid], 200));
  assert.deepEqual(
    good.map((r) => r.segKey),
    ["solid"],
  );
});

test("ກຸ່ມຕ້ອງມີສ່ວນແບ່ງຄົນທັກພໍ ບໍ່ແມ່ນແຕ່ຈຳນວນດິບ", () => {
  // 12 ຄົນທັກ ຜ່ານເກນດິບ ແຕ່ເປັນແຕ່ 1.2% ຂອງ 1000 — ຍັງບາງເກີນ
  const r = row({ segKey: "a", messages: 12 });
  assert.equal(trustedGood(report([r], 1000)).length, 0);
  assert.equal(trustedGood(report([r], 100)).length, 1);
});

test("ກຸ່ມທີ່ໃຊ້ເງິນຫຼາຍແຕ່ບໍ່ມີຄົນທັກ ຍັງຖືກເຕືອນວ່າ 'ບໍ່ດີ' ໄດ້", () => {
  // ນີ້ຄືຈຸດສຳຄັນ: ຄົນທັກ 0 ຄືຫຼັກຖານເອງ ຈຶ່ງໃຊ້ເກນຄົນທັກບໍ່ໄດ້
  const waster = row({
    segKey: "waster",
    messages: 0,
    spendLak: MIN_SPEND_LAK * 2,
    spendShare: 0.2,
  });
  assert.equal(trustedBad(report([waster], 200)).length, 1);
  assert.equal(trustedGood(report([waster], 200)).length, 0);
});

test("ກຸ່ມທີ່ໃຊ້ເງິນໜ້ອຍ ບໍ່ຖືກເອົາໄປແນະນຳວ່າ 'ຄວນຕັດ'", () => {
  const tiny = row({
    segKey: "tiny",
    messages: 1,
    spendLak: MIN_SPEND_LAK - 1,
    spendShare: 0.01,
  });
  assert.equal(trustedBad(report([tiny], 200)).length, 0);
});

test("ແປງເປັນໂດລາຖືກຕ້ອງ ແລະ ຄ່ານ້ອຍມີ 3 ຕຳແໜ່ງ", () => {
  const usd = makeMoney("USD", 21_700);
  assert.equal(usd(304_451), "$14.03");
  // ຄ່າຕໍ່ຄົນທັກນ້ອຍໆ ຕ້ອງບໍ່ຖືກປັດຈົນປຽບທຽບກຸ່ມກັນບໍ່ອອກ
  assert.equal(usd(1_500), "$0.069");
  assert.equal(usd(1_600), "$0.074");
});

test("ສະຫຼັບເປັນກີບແລ້ວບໍ່ມີການແປງ", () => {
  const lak = makeMoney("LAK", 21_700);
  assert.equal(lak(304_451), "304,451 ₭");
});

test("ຊື່ແຂວງລາວທີ່ Facebook ສົ່ງມາຖືກແປເປັນພາສາລາວ", () => {
  assert.equal(segmentLabel("REGION", "Vientiane Prefecture"), "ນະຄອນຫຼວງວຽງຈັນ");
  assert.equal(segmentLabel("REGION", "Houaphanh Province"), "ຫົວພັນ");
  // ຊື່ທີ່ບໍ່ຮູ້ຈັກຕ້ອງສະແດງຕາມເດີມ ບໍ່ແມ່ນວ່າງເປົ່າ
  assert.equal(segmentLabel("REGION", "Nowhere"), "Nowhere");
});

test("ຊົ່ວໂມງ ແລະ ເພດ ຖືກແປງເປັນຄຳອ່ານ", () => {
  assert.equal(segmentLabel("HOUR", "21"), "21:00 – 21:59");
  assert.equal(segmentLabel("AGE_GENDER", "18-24|female"), "18-24 · ຍິງ");
});
