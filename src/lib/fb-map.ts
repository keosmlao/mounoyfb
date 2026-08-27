import { parseDate } from "./date";
import { fromMinorUnits } from "./money";

/**
 * ຕົວແປງຄ່າຈາກ Facebook API → ຄ່າໃນລະບົບເຮົາ.
 *
 * ແຍກອອກຈາກ `fb.ts` ເພາະນີ້ຄືຈຸດທີ່ "ຜິດແລ້ວບໍ່ມີໃຜເຫັນ" —
 * mapping ຜິດ field ດຽວ ຕົວເລກຈະຜິດທັງລະບົບແບບງຽບໆ ຈຶ່ງຕ້ອງມີ test ຄຸມ
 * (`fb-map.test.ts`) ແລະ ໄຟລ໌ນີ້ **ຫ້າມ import prisma** ເພື່ອໃຫ້ test ແລ່ນໄດ້
 * ໂດຍບໍ່ຕ້ອງມີຖານຂໍ້ມູນ.
 */

/** ແປງ objective ຂອງ Facebook (ທັງຊື່ເກົ່າ ແລະ ຊື່ໃໝ່ OUTCOME_*) ມາເປັນຄ່າໃນລະບົບເຮົາ */
export function mapObjective(value?: string) {
  const v = (value ?? "").toUpperCase();
  if (v.includes("MESSAG")) return "MESSAGES" as const;
  if (v.includes("LEAD")) return "LEADS" as const;
  if (v.includes("SALES") || v.includes("CONVERSION")) return "SALES" as const;
  if (v.includes("TRAFFIC") || v.includes("LINK_CLICKS")) return "TRAFFIC" as const;
  if (v.includes("VIDEO")) return "VIDEO_VIEWS" as const;
  if (v.includes("AWARENESS") || v.includes("REACH")) return "AWARENESS" as const;
  if (v.includes("APP")) return "APP_PROMOTION" as const;
  return "ENGAGEMENT" as const;
}

export function mapStatus(value?: string) {
  switch ((value ?? "").toUpperCase()) {
    case "ACTIVE":
      return "ACTIVE" as const;
    case "PAUSED":
      return "PAUSED" as const;
    case "ARCHIVED":
    case "DELETED":
      return "ARCHIVED" as const;
    default:
      return "DRAFT" as const;
  }
}

/** ລະຫັດສະຖານະບັນຊີຂອງ Facebook → ສະຖານະໃນລະບົບເຮົາ */
export function mapAccountStatus(code?: number) {
  switch (code) {
    case 1:
      return "ACTIVE" as const;
    case 100:
    case 101:
      return "ARCHIVED" as const;
    default:
      return "PAUSED" as const;
  }
}

/**
 * ງົບ/ຄ່າປະມູນຈາກ API — Facebook ສົ່ງເປັນ**ຫົວໜ່ວຍນ້ອຍສຸດ**ຂອງສະກຸນບັນຊີ.
 * ຕ້ອງແປງຕາມສະກຸນ ບໍ່ແມ່ນຫານ 100 ຊື່ໆ — ບັນຊີ LAK ບໍ່ມີຫົວໜ່ວຍຍ່ອຍ
 * ຖ້າຫານ 100 ງົບ 1,000,000 ກີບ ຈະກາຍເປັນ 10,000 ກີບ.
 */
export function budgetFromMinor(
  value: string | undefined,
  currency: string,
): number | null {
  return fromMinorUnits(value, currency);
}

/** "2026-07-26T10:00:00+0700" → Date ຂອງວັນນັ້ນ (UTC midnight) ສຳລັບຄໍລຳ @db.Date */
export function dateOnly(value?: string): Date | null {
  return value ? parseDate(value.slice(0, 10)) : null;
}

export type FbAction = { action_type: string; value: string };

/** ລວມຄ່າຂອງ action ຕາມປະເພດທີ່ສົນໃຈ — ປະເພດອື່ນຖືກເມີນ */
export function actionValue(
  actions: FbAction[] | undefined,
  types: string[],
): number {
  if (!actions) return 0;
  let sum = 0;
  for (const a of actions) {
    if (types.includes(a.action_type)) sum += Number(a.value) || 0;
  }
  return sum;
}

/**
 * ປະເພດ action ທີ່ນັບເຂົ້າແຕ່ລະຕົວເລກ — ຊື່ເຫຼົ່ານີ້ມາຈາກ Facebook ໂດຍກົງ.
 * ຖ້າຕົວເລກ "ຄົນທັກ" ຢູ່ລະບົບບໍ່ກົງກັບ Ads Manager ໃຫ້ມາເບິ່ງຊຸດນີ້ກ່ອນ.
 */
export const MESSAGE_ACTIONS = [
  "onsite_conversion.messaging_conversation_started_7d",
  "onsite_conversion.total_messaging_connection",
];
export const LEAD_ACTIONS = ["lead", "onsite_conversion.lead_grouped"];
export const PURCHASE_ACTIONS = [
  "purchase",
  "omni_purchase",
  "offsite_conversion.fb_pixel_purchase",
];
export const VIDEO_ACTIONS = ["video_view", "watch_video_view"];

/** ຫຍໍ້ targeting ຂອງ ad set ໃຫ້ເປັນປະໂຫຍກອ່ານອອກ */
export function summarizeTargeting(targeting: unknown): string | null {
  if (!targeting || typeof targeting !== "object") return null;
  const t = targeting as Record<string, unknown>;
  const parts: string[] = [];

  const ageMin = t.age_min;
  const ageMax = t.age_max;
  if (ageMin || ageMax) parts.push(`ອາຍຸ ${ageMin ?? "?"}-${ageMax ?? "?"}`);

  const genders = t.genders;
  if (Array.isArray(genders) && genders.length === 1) {
    parts.push(genders[0] === 1 ? "ຊາຍ" : "ຍິງ");
  }

  const geo = t.geo_locations as Record<string, unknown> | undefined;
  const countries = geo?.countries;
  if (Array.isArray(countries) && countries.length) {
    parts.push(countries.join(", "));
  }
  const cities = geo?.cities;
  if (Array.isArray(cities) && cities.length) {
    parts.push(`${cities.length} ເມືອງ`);
  }

  const interests = (t.flexible_spec ?? t.interests) as unknown;
  if (Array.isArray(interests) && interests.length) {
    parts.push(`ຄວາມສົນໃຈ ${interests.length} ກຸ່ມ`);
  }

  return parts.length ? parts.join(" · ") : null;
}

/**
 * ແປງຂໍ້ຜິດພາດຂອງ Facebook ໃຫ້ບອກ **ວິທີແກ້** ບໍ່ແມ່ນແຕ່ລະຫັດ error.
 * ໃຊ້ຮ່ວມກັນທັງຝັ່ງໂຄສະນາ ແລະ ຝັ່ງກ່ອງຂໍ້ຄວາມ.
 */
export function explainFbError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("pages_read_user_content")) {
    return (
      "token ຂາດສິດ pages_read_user_content (ອ່ານໂພສ/comment ຂອງເພຈ) — " +
      "ສ້າງ token ໃໝ່ໃຫ້ມີສິດນີ້ ແລ້ວໃສ່ຄືນຢູ່ໜ້າຕັ້ງຄ່າ ແລະ ກົດ “ເຊື່ອມເພຈກັບ Facebook” ອີກເທື່ອ"
    );
  }
  if (message.includes("pages_manage_engagement")) {
    return "token ຂາດສິດ pages_manage_engagement — ຕອບ/ເຊື່ອງ comment ບໍ່ໄດ້";
  }
  if (message.includes("pages_messaging")) {
    return "token ຂາດສິດ pages_messaging — ອ່ານ/ຕອບແຊັດບໍ່ໄດ້";
  }
  if (message.includes("ads_management") || message.includes("code 200")) {
    return "token ຂາດສິດ ads_management — ສັ່ງຢຸດ/ຍິງຕໍ່ ຈາກລະບົບນີ້ບໍ່ໄດ້";
  }
  if (message.includes("code 190")) {
    return "token ໝົດອາຍຸ ຫຼື ຖືກຍົກເລີກ — ສ້າງໃໝ່ແລ້ວໃສ່ຢູ່ໜ້າຕັ້ງຄ່າ";
  }
  if (message.includes("code 100")) {
    return (
      "Facebook ບໍ່ຮັບຄຳສັ່ງນີ້ (code 100) — ສ່ວນຫຼາຍແມ່ນສິ່ງນີ້ຖືກລຶບ ຫຼື " +
      "ເກັບເຂົ້າຄັງຢູ່ Facebook ແລ້ວ. ກົດ “ດຶງຂໍ້ມູນ” ຢູ່ໜ້າຕັ້ງຄ່າ ເພື່ອອັບເດດລາຍການ"
    );
  }
  if (message.includes("code 4") || message.includes("code 17")) {
    return "ຮ້ອງ API ຖີ່ເກີນ (rate limit) — ລໍສັກໜ້ອຍແລ້ວລອງໃໝ່";
  }
  return message;
}
