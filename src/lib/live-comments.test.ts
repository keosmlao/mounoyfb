import test from "node:test";
import assert from "node:assert/strict";
import { ackMessage, classifyLiveComment } from "./live-comments";

test("ຄຳຖາມ — ຄຳຊຸດຂອງພຶດຕິກຳລູກຄ້າ ແລະ ປະໂຫຍກລົງທ້າຍແບບຖາມ", () => {
  assert.equal(classifyLiveComment("ລາຄາເທົ່າໃດ", false).question, true);
  assert.equal(classifyLiveComment("A1 ມີໄຊ XL ບໍ່", false).question, true);
  assert.equal(classifyLiveComment("ສົ່ງຕ່າງແຂວງໄດ້ບໍ", false).question, true);
  assert.equal(classifyLiveComment("ยังมีไหม", false).question, true);
  assert.equal(classifyLiveComment("ງາມຫຼາຍ", false).question, false);
  // "ຈອງ/ຈະເອົາ" ບໍ່ແມ່ນຄຳຖາມ
  assert.equal(classifyLiveComment("ຈະເອົາອັນນີ້", false).question, false);
  // CF ບໍ່ນັບເປັນຄຳຖາມ ເຖິງມີຄຳວ່າລາຄາ
  assert.equal(classifyLiveComment("CF A1 ລາຄາເທົ່າໃດ", true).question, false);
});

test("ກວນ — ລິ້ງ ຫຼື ເບີໂທ", () => {
  assert.equal(classifyLiveComment("ເຂົ້າກຸ່ມ https://t.co/x", false).spam, "link");
  assert.equal(classifyLiveComment("ທັກ wa.me/85620", false).spam, "link");
  assert.equal(classifyLiveComment("ຂາຍຖືກກວ່າ shopdee.com", false).spam, "link");
  assert.equal(classifyLiveComment("ໂທ 020 5555 1234", false).spam, "phone");
  assert.equal(classifyLiveComment("020-55551234", false).spam, "phone");
  assert.equal(classifyLiveComment("໐໒໐໕໕໕໕໑໒໓໔", false).spam, "phone");
  assert.equal(classifyLiveComment("CF A1 2", true).spam, null);
  assert.equal(classifyLiveComment("ລາຄາ 150000", false).spam, null);
});

test("ຕອບຮັບ CF — 1 comment 1 ຄຳຕອບ", () => {
  assert.equal(
    ackMessage([
      { code: "A1", quantity: 2, state: "RESERVED" },
      { code: "B3", quantity: 1, state: "WAITLIST", position: 3 },
    ]),
    "✅ ຮັບ A1 ×2 ແລ້ວ\n⏳ B3 ໝົດແລ້ວ — ທ່ານຢູ່ຄິວ #3\nສະຫຼຸບຍອດຈະສົ່ງເຂົ້າ inbox ຫຼັງຈົບ live 🙏",
  );
  assert.equal(
    ackMessage([{ code: "A1", quantity: 1, state: "WAITLIST", position: 1 }]),
    "⏳ A1 ໝົດແລ້ວ — ທ່ານຢູ່ຄິວ #1",
  );
  assert.match(ackMessage([{ code: null, quantity: 1, state: "UNMATCHED" }])!, /CF A1/);
});

test("CF ຊ້ຳ/ຍົກເລີກ ບໍ່ຕອບ", () => {
  assert.equal(ackMessage([{ code: "A1", quantity: 1, state: "CANCELLED" }]), null);
  assert.equal(ackMessage([]), null);
});
