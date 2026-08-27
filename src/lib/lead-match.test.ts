import assert from "node:assert/strict";
import { test } from "node:test";
import {
  findMatchingLead,
  normalizeName,
  normalizePhone,
  type LeadCandidate,
} from "./lead-match";

/**
 * ຜິດທາງໜຶ່ງ = ລູກຄ້າຊ້ຳເປັນສິບ ອັດຕາປິດການຂາຍຕ່ຳກວ່າຄວາມຈິງ.
 * ຜິດອີກທາງ = ລວມສອງຄົນເປັນຄົນດຽວ ແລ້ວປະຫວັດການຂາຍປົນກັນ.
 * ສອງອັນນີ້ບໍ່ມີໃຜເຫັນຈົນກວ່າຈະສາຍເກີນໄປ ຈຶ່ງຕ້ອງມີ test ຄຸມ.
 */

const LEADS: LeadCandidate[] = [
  { id: "L1", name: "ນາງ ສົມໃຈ", fbName: "Somchai P.", phone: "020 5555 001" },
  { id: "L2", name: "ທ້າວ ບຸນມີ", fbName: "Bounmee K.", phone: null },
  { id: "L3", name: "ນາງ ແກ້ວ", fbName: null, phone: "+856 20 7777 002" },
];

test("ເບີໂທຄົນລະຮູບແບບ ແຕ່ເປັນເບີດຽວກັນ", () => {
  assert.equal(normalizePhone("020 5555 001"), "0205555001");
  assert.equal(normalizePhone("020-5555-001"), "0205555001");
  assert.equal(normalizePhone("+856 20 5555 001"), "0205555001");
  assert.equal(normalizePhone("8562055 55001"), "02055 55001".replace(/\D/g, ""));
});

test("ເບີບໍ່ຄົບ ບໍ່ເອົາໄປທຽບ", () => {
  // ຖ້າຮັບ "5555" ໄປທຽບ ຈະຈັບຜິດຄົນໄດ້ງ່າຍ
  assert.equal(normalizePhone("5555"), null);
  assert.equal(normalizePhone(""), null);
  assert.equal(normalizePhone(null), null);
});

test("ຊື່ທີ່ບອກຫຍັງບໍ່ໄດ້ ບໍ່ນັບເປັນຊື່", () => {
  // ບໍ່ດັ່ງນັ້ນຄົນ “ບໍ່ຮູ້ຊື່” ທຸກຄົນຈະກາຍເປັນຄົນດຽວກັນໝົດ
  assert.equal(normalizeName("ບໍ່ຮູ້ຊື່"), null);
  assert.equal(normalizeName("  "), null);
  assert.equal(normalizeName("-"), null);
  assert.equal(normalizeName("  Somchai   P. "), "somchai p.");
});

test("ພົບຄົນເກົ່າຈາກຊື່ Facebook", () => {
  const hit = findMatchingLead({ fbName: "Bounmee K." }, LEADS);
  assert.equal(hit?.id, "L2");
});

test("ຕົວພິມໃຫຍ່ນ້ອຍ ແລະ ຊ່ອງຫວ່າງ ບໍ່ເຮັດໃຫ້ພາດ", () => {
  const hit = findMatchingLead({ fbName: "  somchai  p.  " }, LEADS);
  assert.equal(hit?.id, "L1");
});

test("ເບີໂທຊະນະຊື່ — ແນ່ນອນກວ່າ", () => {
  // ຊື່ຊີ້ໄປ L2 ແຕ່ເບີຊີ້ໄປ L1 → ຕ້ອງເອົາເບີ
  const hit = findMatchingLead(
    { fbName: "Bounmee K.", phone: "0205555001" },
    LEADS,
  );
  assert.equal(hit?.id, "L1");
});

test("ຄົນທີ່ບັນທຶກໄວ້ດ້ວຍຊື່ລາວ ບໍ່ມີ fbName ກໍ່ຍັງຫາພົບ", () => {
  const hit = findMatchingLead({ fbName: "ນາງ ແກ້ວ" }, LEADS);
  assert.equal(hit?.id, "L3");
});

test("ຄົນໃໝ່ຈິງໆ ຄືນ null ໃຫ້ໄປສ້າງແຖວໃໝ່", () => {
  assert.equal(findMatchingLead({ fbName: "Khamla V." }, LEADS), null);
  assert.equal(findMatchingLead({ fbName: null }, LEADS), null);
  assert.equal(findMatchingLead({ fbName: "ບໍ່ຮູ້ຊື່" }, LEADS), null);
});

test("ບໍ່ມີລູກຄ້າເກົ່າເລີຍ ກໍ່ບໍ່ພັງ", () => {
  assert.equal(findMatchingLead({ fbName: "Somchai P." }, []), null);
});
