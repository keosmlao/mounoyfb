import { SegmentKind } from "@/generated/prisma/enums";

/**
 * ນິຍາມມິຕິການວິເຄາະ — ຕົວກາງລະຫວ່າງ breakdown ຂອງ Facebook ກັບ
 * ຕາຕະລາງ `SegmentInsight` ແລະ ຄຳອ່ານພາສາລາວທີ່ສະແດງໃນໜ້າຈໍ.
 *
 * ⚠️ ຜົນແຍກກຸ່ມແຕ່ລະມິຕິ ຄືຄ່າໂຄສະນາອັນດຽວກັນທີ່ຖືກຫັ່ນຄົນລະແບບ —
 * ບວກຂ້າມມິຕິບໍ່ໄດ້ (ອາຍຸ+ແຂວງ = 2 ເທົ່າ). ລວມໄດ້ພາຍໃນມິຕິດຽວກັນເທົ່ານັ້ນ.
 */

export type SegmentDef = {
  kind: SegmentKind;
  /** ຄ່າ breakdowns ທີ່ສົ່ງໃຫ້ Graph API */
  breakdowns: string;
  /** ຊ່ອງທີ່ Facebook ສົ່ງກັບມາ — ເອົາມາຕໍ່ກັນເປັນ segKey */
  fields: string[];
  label: string;
  /** ຄຳຖາມທີ່ມິຕິນີ້ຕອບໄດ້ — ສະແດງເປັນຄຳອະທິບາຍໃຕ້ຫົວຂໍ້ */
  question: string;
  icon: string;
};

export const SEGMENT_DEFS: SegmentDef[] = [
  {
    kind: SegmentKind.AGE_GENDER,
    breakdowns: "age,gender",
    fields: ["age", "gender"],
    label: "ອາຍຸ ແລະ ເພດ",
    question: "ຄົນກຸ່ມໃດທັກເຂົ້າມາຖືກທີ່ສຸດ?",
    icon: "☺",
  },
  {
    kind: SegmentKind.PLATFORM,
    breakdowns: "publisher_platform,platform_position",
    fields: ["publisher_platform", "platform_position"],
    label: "ບ່ອນວາງໂຄສະນາ",
    question: "ວາງໃສ່ບ່ອນໃດຄຸ້ມທີ່ສຸດ?",
    icon: "▣",
  },
  {
    kind: SegmentKind.REGION,
    breakdowns: "region",
    fields: ["region"],
    label: "ແຂວງ / ພື້ນທີ່",
    question: "ຄົນແຂວງໃດຕອບຮັບດີທີ່ສຸດ?",
    icon: "⚑",
  },
  {
    kind: SegmentKind.HOUR,
    breakdowns: "hourly_stats_aggregated_by_advertiser_time_zone",
    fields: ["hourly_stats_aggregated_by_advertiser_time_zone"],
    label: "ຊົ່ວໂມງໃນມື້",
    question: "ຍິງເວລາໃດຄົນທັກຫຼາຍທີ່ສຸດ?",
    icon: "◷",
  },
];

export function segmentDef(kind: SegmentKind): SegmentDef {
  const def = SEGMENT_DEFS.find((d) => d.kind === kind);
  if (!def) throw new Error(`ບໍ່ຮູ້ຈັກມິຕິ ${kind}`);
  return def;
}

/** ສ້າງ segKey ຈາກແຖວດິບຂອງ Facebook — "18-24|female" */
export function buildSegKey(
  def: SegmentDef,
  row: Record<string, unknown>,
): string | null {
  const parts = def.fields.map((f) => {
    const raw = row[f];
    return typeof raw === "string" ? raw : "";
  });
  if (parts.every((p) => p === "")) return null;

  // ຊົ່ວໂມງມາເປັນ "21:00:00 - 21:59:59" — ເກັບແຕ່ເລກຊົ່ວໂມງ
  if (def.kind === SegmentKind.HOUR) {
    const hour = parts[0].slice(0, 2);
    return /^\d{2}$/.test(hour) ? hour : null;
  }
  return parts.join("|");
}

// --------------------------------------------------------------- ຄຳອ່ານພາສາລາວ

const GENDER: Record<string, string> = {
  female: "ຍິງ",
  male: "ຊາຍ",
  unknown: "ບໍ່ລະບຸ",
};

const PLATFORM: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  messenger: "Messenger",
  audience_network: "Audience Network",
  threads: "Threads",
};

const POSITION: Record<string, string> = {
  feed: "ໜ້າຟີດ",
  facebook_reels: "Reels",
  facebook_reels_overlay: "Reels (ແຖບຊ້ອນ)",
  facebook_profile_feed: "ຟີດໂປຣໄຟລ໌",
  instagram_reels: "Reels (IG)",
  instagram_stories: "ສະຕໍຣີ (IG)",
  story: "ສະຕໍຣີ",
  video_feeds: "ຟີດວິດີໂອ",
  marketplace: "Marketplace",
  search: "ຜົນການຄົ້ນຫາ",
  instream_video: "ໃນວິດີໂອ",
  right_hand_column: "ຖັນຂວາ",
  biz_disco_feed: "ຟີດຄົ້ນພົບທຸລະກິດ",
  groups: "ກຸ່ມ",
  an_classic: "Audience Network",
  rewarded_video: "ວິດີໂອມີລາງວັນ",
};

/** ຊື່ແຂວງລາວທີ່ Facebook ສົ່ງມາເປັນພາສາອັງກິດ */
const REGION_LAO: Record<string, string> = {
  "Vientiane Prefecture": "ນະຄອນຫຼວງວຽງຈັນ",
  "Vientiane Province": "ແຂວງວຽງຈັນ",
  "Champasak Province": "ຈຳປາສັກ",
  "Savannakhet Province": "ສະຫວັນນະເຂດ",
  "Luang Prabang Province": "ຫຼວງພະບາງ",
  "Khammouane Province": "ຄຳມ່ວນ",
  "Xiangkhouang Province": "ຊຽງຂວາງ",
  "Oudomxay Province": "ອຸດົມໄຊ",
  "Bolikhamsai Province": "ບໍລິຄຳໄຊ",
  "Salavan Province": "ສາລະວັນ",
  "Attapeu Province": "ອັດຕະປື",
  "Bokeo Province": "ບໍ່ແກ້ວ",
  "Houaphanh Province": "ຫົວພັນ",
  "Luang Namtha Province": "ຫຼວງນ້ຳທາ",
  "Phongsaly Province": "ຜົ້ງສາລີ",
  "Sainyabuli Province": "ໄຊຍະບູລີ",
  "Sekong Province": "ເຊກອງ",
  "Xaisomboun Province": "ໄຊສົມບູນ",
  Unknown: "ບໍ່ຮູ້ພື້ນທີ່",
};

/** segKey → ຄຳທີ່ຄົນອ່ານເຂົ້າໃຈ */
export function segmentLabel(kind: SegmentKind, segKey: string): string {
  const parts = segKey.split("|");

  switch (kind) {
    case SegmentKind.AGE_GENDER: {
      const [age, gender] = parts;
      return `${age} · ${GENDER[gender] ?? gender}`;
    }
    case SegmentKind.PLATFORM: {
      const [platform, position] = parts;
      return `${PLATFORM[platform] ?? platform} · ${POSITION[position] ?? position}`;
    }
    case SegmentKind.REGION:
      return REGION_LAO[parts[0]] ?? parts[0];
    case SegmentKind.HOUR: {
      const h = Number(parts[0]);
      return `${String(h).padStart(2, "0")}:00 – ${String(h).padStart(2, "0")}:59`;
    }
  }
}

/** ຈັດກຸ່ມຊົ່ວໂມງເປັນຊ່ວງເວລາທີ່ຄົນເຂົ້າໃຈ — ໃຊ້ໃນຄຳແນະນຳ */
export function hourBand(hour: number): string {
  if (hour < 6) return "ເດິກ (00–05)";
  if (hour < 12) return "ເຊົ້າ (06–11)";
  if (hour < 17) return "ບ່າຍ (12–16)";
  if (hour < 21) return "ແລງ (17–20)";
  return "ຄ່ຳ (21–23)";
}
