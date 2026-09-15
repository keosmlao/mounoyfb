import test from "node:test";
import assert from "node:assert/strict";
import { draftFromCaption, findPrice } from "./product-caption";

test("ລາຄາຫຼາຍຮູບແບບ", () => {
  assert.equal(findPrice("ລາຄາ 150,000 ກີບ"), 150_000);
  assert.equal(findPrice("ລາຄາ: 150.000"), 150_000);
  assert.equal(findPrice("ລາຄາ 150k"), 150_000);
  assert.equal(findPrice("ພຽງ 150 ພັນ ເທົ່ານັ້ນ"), 150_000);
  assert.equal(findPrice("ຊຸດນີ້ 1.5 ລ້ານ"), 1_500_000);
  assert.equal(findPrice("99.000₭"), 99_000);
  assert.equal(findPrice("ລາຄາ ໑໒໐,໐໐໐"), 120_000);
  assert.equal(findPrice("Price 250000 LAK"), 250_000);
});

test("ຕົວເລກທີ່ບໍ່ແມ່ນລາຄາ ບໍ່ອ່ານ", () => {
  assert.equal(findPrice("ໄຊ 42 ມີ 3 ສີ"), null);
  assert.equal(findPrice("ໂທ 020 5555 1234"), null);
  assert.equal(findPrice("ລາຄາ 50"), null, "ຕ່ຳກວ່າ 1,000 ກີບ = ອ່ານຜິດ");
  assert.equal(findPrice(""), null);
});

test("ຊື່ຈາກແຖວທຳອິດທີ່ບໍ່ແມ່ນ hashtag/ລາຄາ", () => {
  assert.deepEqual(
    draftFromCaption("🔥🔥 ເສື້ອຍືດ Oversize ຜ້າຝ້າຍ ✨\nລາຄາ 129,000 ກີບ\n#ເສື້ອ #ມືໜຶ່ງ"),
    { name: "ເສື້ອຍືດ Oversize ຜ້າຝ້າຍ", price: 129_000 },
  );
  assert.deepEqual(draftFromCaption("#ໂປຣ #ມາໃໝ່\nກະເປົາໜັງ ລາຄາ 350k"), {
    name: "ກະເປົາໜັງ",
    price: 350_000,
  });
  assert.deepEqual(draftFromCaption(null), { name: "", price: null });
});
