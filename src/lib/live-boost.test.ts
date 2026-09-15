import test from "node:test";
import assert from "node:assert/strict";
import { buildTargeting, budgetInLak, storyId, validateBoost, type BoostInput } from "./live-boost";

const ok: BoostInput = { budget: 10, currency: "USD", hours: 3, ageMin: 18, ageMax: 45, gender: "all" };
const RATE = 21_700;

test("ຜ່ານເມື່ອຄ່າຖືກ ແລະ ຢູ່ໃຕ້ເພດານ (ທຽບເປັນກີບ)", () => {
  assert.deepEqual(validateBoost(ok, 500_000, RATE), []);
  assert.equal(budgetInLak(10, "USD", RATE), 217_000);
  assert.equal(budgetInLak(200_000, "LAK", RATE), 200_000);
});

test("ບໍ່ໄດ້ຕັ້ງເພດານ = ຫ້າມ boost", () => {
  assert.match(validateBoost(ok, null, RATE)[0], /ເພດານ/);
  assert.match(validateBoost(ok, 0, RATE)[0], /ເພດານ/);
});

test("ພິມງົບຜິດ (500 ແທນ 5) ຖືກກັນດ້ວຍເພດານ", () => {
  const problems = validateBoost({ ...ok, budget: 500 }, 500_000, RATE);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /ເກີນເພດານ/);
});

test("ຄ່າທີ່ Facebook ບໍ່ຮັບ", () => {
  assert.equal(validateBoost({ ...ok, budget: 0 }, 500_000, RATE).length, 1);
  assert.equal(validateBoost({ ...ok, hours: 0 }, 500_000, RATE).length, 1);
  assert.equal(validateBoost({ ...ok, hours: 1.5 }, 500_000, RATE).length, 1);
  assert.equal(validateBoost({ ...ok, ageMin: 16 }, 500_000, RATE).length, 1);
  assert.equal(validateBoost({ ...ok, ageMin: 40, ageMax: 30 }, 500_000, RATE).length, 1);
});

test("targeting ລາວ + Facebook ເທົ່ານັ້ນ", () => {
  assert.deepEqual(buildTargeting({ ageMin: 20, ageMax: 40, gender: "female" }), {
    geo_locations: { countries: ["LA"] },
    age_min: 20,
    age_max: 40,
    genders: [2],
    publisher_platforms: ["facebook"],
  });
  assert.equal("genders" in buildTargeting({ ageMin: 18, ageMax: 65, gender: "all" }), false);
});

test("object_story_id ມີ page id ນຳໜ້າສະເໝີ", () => {
  assert.equal(storyId("111", "222"), "111_222");
  assert.equal(storyId("111", "111_222"), "111_222");
});
