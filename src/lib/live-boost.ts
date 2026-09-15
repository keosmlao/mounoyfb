/**
 * Boost live — ກົດທີ່ບໍ່ແຕະເງິນຈິງ ແຍກໄວ້ບ່ອນນີ້ (ບໍລິສຸດ · ມີ test ຄຸມ).
 * ການສ້າງໂຄສະນາຢູ່ Facebook ຢູ່ `live-boost-server.ts`.
 *
 * ການ boost **ໃຊ້ເງິນຈິງ** — ທຸກຄ່າຕ້ອງຜ່ານ `validateBoost()` ກ່ອນສົ່ງໄປ Facebook
 * ແລະ ເພດານທຽບເປັນ**ກີບ**ສະເໝີ (ບັນຊີໂຄສະນາສ່ວນຫຼາຍເປັນ USD).
 */

export type BoostGender = "all" | "male" | "female";

export type BoostInput = {
  /** ງົບລວມຂອງການ boost ເທື່ອນີ້ — ສະກຸນຂອງບັນຊີໂຄສະນາ */
  budget: number;
  currency: string;
  hours: number;
  ageMin: number;
  ageMax: number;
  gender: BoostGender;
};

export const BOOST_HOURS = { min: 1, max: 72 } as const;
/** Facebook ບໍ່ຮັບອາຍຸຕ່ຳກວ່າ 18 ຫຼື ສູງກວ່າ 65 (65 = 65 ປີຂຶ້ນໄປ) */
export const BOOST_AGE = { min: 18, max: 65 } as const;

/** ງົບເປັນກີບ — ບັນຊີກີບບໍ່ຕ້ອງແປງ */
export function budgetInLak(budget: number, currency: string, rateToLak: number): number {
  return currency.toUpperCase() === "LAK" ? budget : budget * rateToLak;
}

/**
 * ກວດຄ່າກ່ອນສ້າງໂຄສະນາ — ຄືນລາຍການບັນຫາ (ວ່າງ = ຜ່ານ).
 * `capLak` null = ຍັງບໍ່ໄດ້ຕັ້ງເພດານ → **ຫ້າມ boost** ຈົນກວ່າຜູ້ດູແລຈະຕັ້ງ.
 */
export function validateBoost(
  input: BoostInput,
  capLak: number | null,
  rateToLak: number,
): string[] {
  const problems: string[] = [];

  if (capLak === null || !(capLak > 0)) {
    problems.push("ຍັງບໍ່ໄດ້ຕັ້ງເພດານງົບຂອງການ boost — ຜູ້ດູແລລະບົບຕ້ອງຕັ້ງກ່ອນ");
  }
  if (!Number.isFinite(input.budget) || input.budget <= 0) {
    problems.push("ງົບຕ້ອງຫຼາຍກວ່າ 0");
  } else if (capLak !== null && capLak > 0) {
    const lak = budgetInLak(input.budget, input.currency, rateToLak);
    if (lak > capLak) {
      problems.push(
        `ງົບ ${input.budget} ${input.currency} (≈ ${Math.round(lak).toLocaleString("en-US")} ກີບ) ` +
          `ເກີນເພດານ ${Math.round(capLak).toLocaleString("en-US")} ກີບ`,
      );
    }
  }
  if (!Number.isInteger(input.hours) || input.hours < BOOST_HOURS.min || input.hours > BOOST_HOURS.max) {
    problems.push(`ໄລຍະເວລາຕ້ອງເປັນ ${BOOST_HOURS.min}–${BOOST_HOURS.max} ຊົ່ວໂມງ`);
  }
  if (
    !Number.isInteger(input.ageMin) ||
    !Number.isInteger(input.ageMax) ||
    input.ageMin < BOOST_AGE.min ||
    input.ageMax > BOOST_AGE.max ||
    input.ageMin > input.ageMax
  ) {
    problems.push(`ອາຍຸຕ້ອງຢູ່ລະຫວ່າງ ${BOOST_AGE.min}–${BOOST_AGE.max} ແລະ ຕ່ຳສຸດບໍ່ເກີນສູງສຸດ`);
  }
  if (!["all", "male", "female"].includes(input.gender)) {
    problems.push("ເພດບໍ່ຖືກຕ້ອງ");
  }
  return problems;
}

/**
 * targeting ຂອງ Facebook — ປະເທດລາວ ແລະ ສະເພາະ Facebook
 * (live ຂອງເພຈສະແດງໃນ Instagram ບໍ່ໄດ້). genders: 1 = ຊາຍ, 2 = ຍິງ.
 */
export function buildTargeting(input: Pick<BoostInput, "ageMin" | "ageMax" | "gender">) {
  return {
    geo_locations: { countries: ["LA"] },
    age_min: input.ageMin,
    age_max: input.ageMax,
    ...(input.gender === "male" ? { genders: [1] } : input.gender === "female" ? { genders: [2] } : {}),
    publisher_platforms: ["facebook"],
  };
}

/** ຊື່ທີ່ເຫັນໃນ Ads Manager — ຂຶ້ນຕົ້ນດ້ວຍ [Live] ຈຶ່ງແຍກອອກຈາກແຄມເປນອື່ນໄດ້ງ່າຍ */
export function boostName(title: string, at: Date): string {
  const stamp = at.toISOString().slice(0, 16).replace("T", " ");
  return `[Live] ${title.slice(0, 60)} · ${stamp} UTC`;
}

/**
 * id ຂອງໂພສທີ່ໃຊ້ເປັນ `object_story_id` — ຕ້ອງເປັນຮູບ "<pageId>_<postId>".
 * Facebook ຄືນ post_id ມາທັງແບບມີ ແລະ ບໍ່ມີ page id ນຳໜ້າ.
 */
export function storyId(fbPageId: string, postId: string): string {
  return postId.includes("_") ? postId : `${fbPageId}_${postId}`;
}

export const GENDER_LABEL: Record<BoostGender, string> = {
  all: "ທຸກເພດ",
  male: "ຊາຍ",
  female: "ຍິງ",
};
