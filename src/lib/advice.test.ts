import assert from "node:assert/strict";
import { test } from "node:test";
import { confidenceFrom, ADVICE_TONE } from "./advice-types";
import { suggestBudgetStep } from "./advice-types";

/**
 * ຄວາມໝັ້ນໃຈ ແລະ % ງົບທີ່ແນະນຳ ຄືສອງຢ່າງທີ່ຄົນເອົາໄປຕັດສິນໃຈໃຊ້ເງິນຈິງ
 * — ຖ້າພັງ ຈະບໍ່ມີໃຜເຫັນວ່າມັນພັງຈົນເສຍເງິນໄປແລ້ວ.
 */

test("ຄວາມໝັ້ນໃຈຂຶ້ນກັບວ່າຂໍ້ມູນຫຼາຍກວ່າຂັ້ນຕ່ຳຈັກເທົ່າ", () => {
  assert.equal(confidenceFrom(30, 10), "high");   // 3 ເທົ່າ
  assert.equal(confidenceFrom(15, 10), "medium"); // 1.5 ເທົ່າ
  assert.equal(confidenceFrom(10, 10), "low");    // ພໍດີຂັ້ນຕ່ຳ
  assert.equal(confidenceFrom(3, 10), "low");
});

test("ຂັ້ນຕ່ຳເປັນ 0 ບໍ່ເຮັດໃຫ້ໝັ້ນໃຈສູງແບບຜິດໆ", () => {
  assert.equal(confidenceFrom(100, 0), "low");
});

test("% ງົບທີ່ແນະນຳ ບໍ່ເກີນ 30% ເພື່ອບໍ່ໃຫ້ Facebook ກັບໄປຮຽນຮູ້ໃໝ່", () => {
  // ຄຸ້ມກວ່າສະເລ່ຍ 10 ເທົ່າ ກໍ່ຍັງບໍ່ໃຫ້ເພີ່ມເກີນ 30%
  assert.equal(suggestBudgetStep(0.1), "30%");
  assert.equal(suggestBudgetStep(0.5), "30%");
});

test("% ງົບຢ່າງໜ້ອຍ 10% ເພື່ອໃຫ້ເຫັນຜົນຈິງ", () => {
  assert.equal(suggestBudgetStep(0.99), "10%");
  assert.equal(suggestBudgetStep(0), "20%");
});

test("ທຸກປະເພດຄຳແນະນຳມີປ້າຍ ແລະ ສີກຳກັບ", () => {
  for (const kind of ["cut", "scale", "shift", "watch", "wait", "info"] as const) {
    const t = ADVICE_TONE[kind];
    assert.ok(t.label.length > 0, `${kind} ບໍ່ມີປ້າຍ`);
    assert.ok(t.tone.length > 0, `${kind} ບໍ່ມີສີ`);
  }
});
