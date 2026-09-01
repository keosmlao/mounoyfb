import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildTarget,
  DECIDE_DAYS,
  LEARNING_DAYS,
  MIN_MESSAGES,
  planAll,
  planCampaign,
  setupSteps,
  stageOf,
  suggestDailyBudget,
  type CampaignInput,
  type Target,
} from "./playbook";
import { makeMoney } from "./money";

/**
 * ກົດເຫຼົ່ານີ້ຄືສິ່ງທີ່ບອກຄົນວ່າ "ຕັດ" ຫຼື "ເພີ່ມງົບ" ດ້ວຍເງິນຈິງ.
 * ຜິດເບື້ອງໃດເບື້ອງໜຶ່ງກໍ່ເສຍເງິນ: ຕັດໄວເກີນ = ຖິ້ມແຄມເປນທີ່ຍັງດີ,
 * ຕັດຊ້າເກີນ = ຈ່າຍຄ່າໂຄສະນາໃຫ້ຂອງທີ່ພັງແລ້ວ.
 */

const money = makeMoney("LAK", 21_700);

/** ກຳໄລ 200,000/ອໍເດີ · ປິດໄດ້ 10% → ເປົ້າ = 20,000 ກີບ/ຄົນທັກ */
const TARGET: Target = buildTarget({
  marginPerOrder: 200_000,
  orders: 10,
  messages: 100,
});

function campaign(over: Partial<CampaignInput> & { id: string }): CampaignInput {
  return {
    name: `ແຄມເປນ ${over.id}`,
    ageDays: 10,
    messages: 50,
    spendLak: 1_000_000,
    dailyBudget: null,
    ...over,
  };
}

// ------------------------------------------------------------ ເປົ້າ

test("ເປົ້າ = ກຳໄລຕໍ່ອໍເດີ × ອັດຕາປິດການຂາຍ", () => {
  assert.equal(TARGET.closeRate, 0.1);
  assert.equal(TARGET.costPerMessage, 20_000);
  assert.equal(TARGET.missing, null);
});

test("ບໍ່ຮູ້ກຳໄລ = ບໍ່ມີເປົ້າ ແລະ ບອກວ່າຂາດຫຍັງ", () => {
  const t = buildTarget({ marginPerOrder: 0, orders: 10, messages: 100 });
  assert.equal(t.costPerMessage, 0);
  assert.match(t.missing!, /ກຳໄລ/);
});

test("ມີກຳໄລແຕ່ຍັງບໍ່ມີອໍເດີ = ບໍ່ມີເປົ້າ (ຫ້າມເດົາອັດຕາປິດ)", () => {
  const t = buildTarget({ marginPerOrder: 200_000, orders: 0, messages: 100 });
  assert.equal(t.costPerMessage, 0);
  assert.match(t.missing!, /ອັດຕາປິດ/);
});

test("ງົບຕໍ່ວັນທີ່ແນະນຳ ອີງຕາມເປົ້າ ບໍ່ແມ່ນຄ່າຄົງທີ່", () => {
  assert.equal(suggestDailyBudget(TARGET), 100_000);
  assert.equal(suggestDailyBudget(buildTarget({ marginPerOrder: 0, orders: 0, messages: 0 })), 0);
});

// ------------------------------------------------------------ ຂັ້ນຕອນ

test("ຂັ້ນຕອນແບ່ງຕາມອາຍຸ", () => {
  assert.equal(stageOf(0), "learning");
  assert.equal(stageOf(LEARNING_DAYS - 1), "learning");
  assert.equal(stageOf(LEARNING_DAYS), "testing");
  assert.equal(stageOf(DECIDE_DAYS - 1), "testing");
  assert.equal(stageOf(DECIDE_DAYS), "deciding");
});

// ------------------------------------------------------------ ຄຳສັ່ງ

test("ຊ່ວງຮຽນຮູ້ ຫ້າມແຕະ ເຖິງຕົວເລກຈະຮ້າຍ", () => {
  const p = planCampaign(
    campaign({ id: "a", ageDays: 1, messages: 1, spendLak: 900_000 }),
    TARGET,
    money,
  );
  assert.equal(p.action, "wait");
  assert.match(p.next, /ຮຽນຮູ້ໃໝ່/);
});

test("ຄົນທັກຍັງບາງ ຫ້າມຕັດສິນ", () => {
  const p = planCampaign(
    campaign({ id: "a", ageDays: 5, messages: MIN_MESSAGES - 1, spendLak: 500_000 }),
    TARGET,
    money,
  );
  assert.equal(p.action, "data");
});

test("ແພງກວ່າເປົ້າຕອນຍັງທົດສອບ = ປ່ຽນຮູບກ່ອນ ບໍ່ແມ່ນຕັດ", () => {
  const p = planCampaign(
    // 30 ຄົນທັກ 1,500,000 → 50,000/ຄົນ = 2.5 ເທົ່າຂອງເປົ້າ
    campaign({ id: "a", ageDays: 5, messages: 30, spendLak: 1_500_000 }),
    TARGET,
    money,
  );
  assert.equal(p.action, "creative");
  assert.match(p.reason, /150%/);
});

test("ແພງກວ່າເປົ້າ ແລະ ພິສູດພຽງພໍແລ້ວ = ຕັດ", () => {
  const p = planCampaign(
    campaign({ id: "a", ageDays: 9, messages: 30, spendLak: 1_500_000 }),
    TARGET,
    money,
  );
  assert.equal(p.action, "cut");
});

test("ຄຸ້ມກວ່າເປົ້າຊັດເຈນ = ເພີ່ມງົບເທື່ອລະໜ້ອຍ", () => {
  const p = planCampaign(
    // 100 ຄົນທັກ 1,000,000 → 10,000/ຄົນ = ເຄິ່ງໜຶ່ງຂອງເປົ້າ
    campaign({ id: "a", ageDays: 9, messages: 100, spendLak: 1_000_000 }),
    TARGET,
    money,
  );
  assert.equal(p.action, "scale");
  assert.match(p.next, /3 ວັນ/);
});

test("ຢູ່ໃນເກນ = ຢ່າໄປແກ້", () => {
  const p = planCampaign(
    // 50 ຄົນທັກ 1,000,000 → 20,000 = ພໍດີເປົ້າ
    campaign({ id: "a", ageDays: 9, messages: 50, spendLak: 1_000_000 }),
    TARGET,
    money,
  );
  assert.equal(p.action, "keep");
  assert.equal(p.index, 1);
});

test("ໃຊ້ເງິນໄປແລ້ວແຕ່ບໍ່ມີຄົນທັກເລີຍ = ຕັດໄດ້ ໂດຍບໍ່ຕ້ອງລໍຄົນທັກຄົບ", () => {
  const p = planCampaign(
    campaign({ id: "a", ageDays: 4, messages: 0, spendLak: 400_000 }),
    TARGET,
    money,
  );
  assert.equal(p.action, "cut");
  assert.match(p.next, /ປຸ່ມກົດ|ຮູບ/);
});

test("ບໍ່ມີເປົ້າ = ບອກໄດ້ແຕ່ຕົວເລກດິບ ບໍ່ກ້າສັ່ງຕັດ", () => {
  const noTarget = buildTarget({ marginPerOrder: 0, orders: 0, messages: 0 });
  const p = planCampaign(
    campaign({ id: "a", ageDays: 30, messages: 5, spendLak: 5_000_000 }),
    noTarget,
    money,
  );
  assert.equal(p.action, "data");
  assert.match(p.next, /ກຳໄລ/);
});

test("ຮຽງສິ່ງທີ່ຕ້ອງລົງມືກ່ອນຂຶ້ນເທິງສຸດ", () => {
  const plans = planAll(
    [
      campaign({ id: "keep", messages: 50, spendLak: 1_000_000 }),
      campaign({ id: "cut", messages: 30, spendLak: 1_500_000 }),
      campaign({ id: "learning", ageDays: 1 }),
      campaign({ id: "scale", messages: 100, spendLak: 1_000_000 }),
    ],
    TARGET,
    money,
  );
  // ຕັດ/ເພີ່ມງົບ ຂຶ້ນກ່ອນ · ແຄມເປນໜຸ່ມທີ່ຈະຕ້ອງຕັດສິນໃນອີກສອງສາມມື້
  // ມາກ່ອນອັນທີ່ນິ້ງແລ້ວ (keep) ເພາະຕ້ອງກັບມາເບິ່ງມັນອີກ
  assert.deepEqual(
    plans.map((p) => p.id),
    ["cut", "scale", "learning", "keep"],
  );
});

// ------------------------------------------------------------ ຕັ້ງໃໝ່

test("ຂັ້ນຕອນຕັ້ງໃໝ່ ໃສ່ຕົວເລກຈິງ ບໍ່ແມ່ນຄ່າຄົງທີ່", () => {
  const steps = setupSteps(TARGET, money);
  assert.match(steps[0].detail, /20,000 ₭/);
  assert.match(steps[1].detail, /100,000 ₭/);
});

test("ບໍ່ມີເປົ້າ ຂັ້ນຕອນຕັ້ງໃໝ່ບອກວ່າຂາດຫຍັງ ແທນທີ່ຈະໃສ່ຕົວເລກປອມ", () => {
  const steps = setupSteps(
    buildTarget({ marginPerOrder: 0, orders: 0, messages: 0 }),
    money,
  );
  assert.match(steps[0].detail, /ກຳໄລ/);
  assert.doesNotMatch(steps[1].detail, /₭/);
});
