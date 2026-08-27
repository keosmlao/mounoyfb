import assert from "node:assert/strict";
import test from "node:test";
import { parseCanned } from "./canned";

test("parseCanned ຕັດຊ່ອງວ່າງ ແລະ ອັນຊ້ຳອອກ", () => {
  const out = parseCanned("  ລາຄາ 29,000  \n\nລາຄາ 29,000\nວິທີສັ່ງ\n   \n");
  assert.deepEqual(out, ["ລາຄາ 29,000", "ວິທີສັ່ງ"]);
});

test("parseCanned ຈຳກັດຢູ່ 12 ແຖວ", () => {
  const many = Array.from({ length: 20 }, (_, i) => `ຄຳຕອບ ${i}`).join("\n");
  assert.equal(parseCanned(many).length, 12);
});
