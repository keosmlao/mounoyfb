import assert from "node:assert/strict";
import { test } from "node:test";
import {
  actionValue,
  budgetFromMinor,
  dateOnly,
  explainFbError,
  MESSAGE_ACTIONS,
  mapAccountStatus,
  mapObjective,
  mapStatus,
  PURCHASE_ACTIONS,
  summarizeTargeting,
} from "./fb-map";

/**
 * ຕົວແປງເຫຼົ່ານີ້ຄືປະຕູທີ່ຂໍ້ມູນ Facebook ໄຫຼເຂົ້າລະບົບ —
 * ຜິດ field ດຽວ ຕົວເລກຈະຜິດທັງລະບົບໂດຍທີ່ໜ້າຈໍບໍ່ຟ້ອງຫຍັງເລີຍ.
 */

test("objective ທັງຊື່ເກົ່າ ແລະ ຊື່ໃໝ່ OUTCOME_* ຂອງ Facebook", () => {
  // ຊື່ໃໝ່ທີ່ Facebook ໃຊ້ຕັ້ງແຕ່ Marketing API v17+
  assert.equal(mapObjective("OUTCOME_ENGAGEMENT"), "ENGAGEMENT");
  assert.equal(mapObjective("OUTCOME_SALES"), "SALES");
  assert.equal(mapObjective("OUTCOME_TRAFFIC"), "TRAFFIC");
  assert.equal(mapObjective("OUTCOME_LEADS"), "LEADS");
  assert.equal(mapObjective("OUTCOME_AWARENESS"), "AWARENESS");
  assert.equal(mapObjective("OUTCOME_APP_PROMOTION"), "APP_PROMOTION");
  // ຊື່ເກົ່າ
  assert.equal(mapObjective("MESSAGES"), "MESSAGES");
  assert.equal(mapObjective("LINK_CLICKS"), "TRAFFIC");
  assert.equal(mapObjective("CONVERSIONS"), "SALES");
  assert.equal(mapObjective("VIDEO_VIEWS"), "VIDEO_VIEWS");
  assert.equal(mapObjective("REACH"), "AWARENESS");
  // ບໍ່ຮູ້ຈັກ = ENGAGEMENT ບໍ່ແມ່ນພັງ
  assert.equal(mapObjective("SOMETHING_NEW"), "ENGAGEMENT");
  assert.equal(mapObjective(undefined), "ENGAGEMENT");
});

test("ສະຖານະແຄມເປນ — DELETED ນັບເປັນເກັບເຂົ້າຄັງ ບໍ່ແມ່ນຫາຍ", () => {
  assert.equal(mapStatus("ACTIVE"), "ACTIVE");
  assert.equal(mapStatus("PAUSED"), "PAUSED");
  assert.equal(mapStatus("ARCHIVED"), "ARCHIVED");
  // ຖືກລຶບຢູ່ Facebook — ເກັບເຂົ້າຄັງເພື່ອຮັກສາຄ່າໂຄສະນາໃນອະດີດ
  assert.equal(mapStatus("DELETED"), "ARCHIVED");
  assert.equal(mapStatus("IN_PROCESS"), "DRAFT");
  assert.equal(mapStatus(undefined), "DRAFT");
});

test("ສະຖານະບັນຊີໂຄສະນາ", () => {
  assert.equal(mapAccountStatus(1), "ACTIVE");
  assert.equal(mapAccountStatus(100), "ARCHIVED");
  assert.equal(mapAccountStatus(101), "ARCHIVED");
  // 2 = disabled — ຍັງເຫັນຢູ່ ແຕ່ບໍ່ໄດ້ຍິງ
  assert.equal(mapAccountStatus(2), "PAUSED");
  assert.equal(mapAccountStatus(undefined), "PAUSED");
});

test("ງົບແປງຕາມສະກຸນ — LAK ຫ້າມຫານ 100", () => {
  // USD: "250" = $2.50 (ຢືນຢັນກັບ Facebook ຈິງແລ້ວໃນການທົດສອບ live)
  assert.equal(budgetFromMinor("250", "USD"), 2.5);
  // LAK ບໍ່ມີຫົວໜ່ວຍຍ່ອຍ: "1000000" = 1,000,000 ກີບ
  // (ໂຄດເກົ່າຫານ 100 ຊື່ໆ — ງົບກີບຈະຜິດ 100 ເທົ່າ)
  assert.equal(budgetFromMinor("1000000", "LAK"), 1_000_000);
  assert.equal(budgetFromMinor(undefined, "USD"), null);
});

test("ວັນທີ່ຈາກ timestamp ຂອງ Facebook ບໍ່ເລື່ອນວັນຕາມ timezone", () => {
  // ຕີ 0:30 ເວລາລາວ — ຖ້າແປງຜ່ານ Date ປົກກະຕິຈະກາຍເປັນມື້ກ່ອນ (UTC)
  const d = dateOnly("2026-07-26T00:30:00+0700");
  assert.equal(d?.toISOString(), "2026-07-26T00:00:00.000Z");
  assert.equal(dateOnly(undefined), null);
});

test("ນັບ action ສະເພາະປະເພດທີ່ຂໍ — ປະເພດອື່ນບໍ່ປົນເຂົ້າມາ", () => {
  const actions = [
    { action_type: "onsite_conversion.messaging_conversation_started_7d", value: "12" },
    { action_type: "purchase", value: "3" },
    { action_type: "post_engagement", value: "999" },
    { action_type: "onsite_conversion.total_messaging_connection", value: "5" },
  ];
  assert.equal(actionValue(actions, MESSAGE_ACTIONS), 17);
  assert.equal(actionValue(actions, PURCHASE_ACTIONS), 3);
  assert.equal(actionValue(undefined, MESSAGE_ACTIONS), 0);
  // ຄ່າເສຍ ("abc") ນັບເປັນ 0 ບໍ່ແມ່ນ NaN ທີ່ຈະລາມໄປທັງຍອດ
  assert.equal(
    actionValue([{ action_type: "purchase", value: "abc" }], PURCHASE_ACTIONS),
    0,
  );
});

test("ຫຍໍ້ targeting ເປັນປະໂຫຍກອ່ານອອກ", () => {
  const text = summarizeTargeting({
    age_min: 18,
    age_max: 45,
    genders: [2],
    geo_locations: { countries: ["LA"], cities: [{ key: "1" }, { key: "2" }] },
  });
  assert.equal(text, "ອາຍຸ 18-45 · ຍິງ · LA · 2 ເມືອງ");
  // ທັງສອງເພດ = ບໍ່ຕ້ອງບອກເພດ
  assert.ok(!summarizeTargeting({ genders: [1, 2], age_min: 20 })?.includes("ຊາຍ"));
  assert.equal(summarizeTargeting(null), null);
  assert.equal(summarizeTargeting({}), null);
});

test("ຂໍ້ຜິດພາດ Facebook ຖືກແປເປັນວິທີແກ້ ບໍ່ແມ່ນລະຫັດ", () => {
  assert.match(explainFbError(new Error("Facebook API: x (code 190)")), /ໝົດອາຍຸ/);
  assert.match(explainFbError(new Error("Facebook API: y (code 4)")), /rate limit/);
  assert.match(explainFbError(new Error("Facebook API: z (code 100)")), /ຖືກລຶບ/);
  assert.match(explainFbError(new Error("needs ads_management")), /ads_management/);
  assert.match(
    explainFbError(new Error("requires pages_messaging permission")),
    /ແຊັດ/,
  );
  // ອັນທີ່ບໍ່ຮູ້ຈັກ — ສົ່ງຂໍ້ຄວາມເດີມຄືນ ບໍ່ກືນຫາຍ
  assert.equal(explainFbError(new Error("ອື່ນໆ")), "ອື່ນໆ");
});
