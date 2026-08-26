import assert from "node:assert/strict";
import test from "node:test";
import { fromMinorUnits } from "./money";

test("ຄ່າເງິນຈາກ Facebook ແປງຈາກຫົວໜ່ວຍນ້ອຍສຸດຖືກຕ້ອງ", () => {
  // ຢືນຢັນກັບຄ່າຈິງຂອງບັນຊີ SMLAO: "1403" = $14.03
  assert.equal(fromMinorUnits("1403", "USD"), 14.03);
  assert.equal(fromMinorUnits("3", "USD"), 0.03);
  assert.equal(fromMinorUnits(0, "USD"), 0);
});

test("ສະກຸນທີ່ບໍ່ມີຫົວໜ່ວຍຍ່ອຍຫ້າມຫານ 100", () => {
  // ຫານແລ້ວ 1,403,000 ກີບ ຈະກາຍເປັນ 14,030 ກີບ — ຜິດ 100 ເທົ່າ
  assert.equal(fromMinorUnits("1403000", "LAK"), 1_403_000);
  assert.equal(fromMinorUnits("5000", "VND"), 5000);
  assert.equal(fromMinorUnits("1403", "lak"), 1403, "ຕ້ອງບໍ່ສົນຕົວພິມນ້ອຍ/ໃຫຍ່");
});

test("ບໍ່ມີຄ່າ ຄືນ null ເພື່ອບໍ່ໃຫ້ສັບສົນກັບສູນ", () => {
  assert.equal(fromMinorUnits(null, "USD"), null);
  assert.equal(fromMinorUnits(undefined, "USD"), null);
  assert.equal(fromMinorUnits("", "USD"), null);
  assert.equal(fromMinorUnits("abc", "USD"), null);
});
