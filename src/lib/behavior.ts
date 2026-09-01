import { laoHour, laoWeekday, weekdayLao } from "./date";
import { hourBand } from "./segments";
import { formatInt, safeDiv } from "./format";
import { confidenceFrom, type Advice } from "./advice-types";
import type { MoneyFn } from "./money";

/**
 * ພຶດຕິກຳລູກຄ້າ — ວິເຄາະ **ຝັ່ງເຮົາເອງ** (ແຊັດ · ລູກຄ້າ · ອໍເດີ)
 * ບໍ່ແມ່ນຕົວເລກທີ່ Facebook ລາຍງານ.
 *
 * `analysis.ts` ຕອບວ່າ "ເງິນລົງໃສ່ໃຜແລ້ວຄຸ້ມ" ຈາກຂໍ້ມູນຂອງ Facebook.
 * ໄຟລ໌ນີ້ຕອບອີກເຄິ່ງໜຶ່ງທີ່ Facebook ບອກບໍ່ໄດ້: ຄົນທັກມາ**ເວລາໃດ**,
 * ເຮົາ**ຕອບໄວປານໃດ**, ເຂົາ**ຖາມຫຍັງກ່ອນ**, ແລະ ຫຼັງທັກແລ້ວ**ດົນປານໃດຈຶ່ງຊື້**
 * — ແລ້ວແປງເປັນຄຳຕອບວ່າ "ຄວນຍິງໂຄສະນາແນວໃດ".
 *
 * ໄຟລ໌ນີ້ຕ້ອງ**ບໍລິສຸດ** (ຫ້າມ import prisma) ແລະ ມີ test ຄຸມ —
 * ການອ່ານຖານຂໍ້ມູນຢູ່ `behavior-server.ts`.
 *
 * ຫຼັກການດຽວກັບ `advice.ts`: ຂໍ້ມູນບາງໆບອກຫຍັງບໍ່ໄດ້ ສົງໄສໃຫ້ງຽບໄວ້.
 */

// --------------------------------------------------------------- ຂໍ້ມູນເຂົ້າ

export type ThreadFact = {
  id: string;
  /** ເວລາລູກຄ້າທັກຄັ້ງທຳອິດໃນຊ່ວງທີ່ເບິ່ງ (ເວລາຈິງ) */
  firstInboundAt: Date;
  /** ເວລາເພຈຕອບຫຼັງຈາກນັ້ນ — null = ຍັງບໍ່ໄດ້ຕອບ */
  firstReplyAt: Date | null;
  /** ຂໍ້ຄວາມຈາກລູກຄ້າ (ໃຊ້ຫາວ່າເຂົາຖາມຫຍັງ) */
  texts: string[];
  /** ຜູກກັບລູກຄ້າໃນລະບົບແລ້ວບໍ່ — ບໍ່ຜູກ = ຄິດອັດຕາປິດຈາກແຊັດນີ້ບໍ່ໄດ້ */
  leadId: string | null;
  /** ລູກຄ້າທີ່ຜູກໄວ້ມີອໍເດີແລ້ວບໍ່ */
  ordered: boolean;
};

export type OrderFact = {
  /** ວັນທີ່ອໍເດີ "YYYY-MM-DD" */
  day: string;
  /** ວັນທີ່ລູກຄ້າຄົນນີ້ເຂົ້າມາ (Lead.date) — null = ບໍ່ໄດ້ຜູກກັບລູກຄ້າ */
  leadDay: string | null;
  delivered: boolean;
  phone: string | null;
};

export type BehaviorInput = {
  threads: ThreadFact[];
  orders: OrderFact[];
  /** ຈຳນວນລູກຄ້າ (Lead) ທີ່ເກີດໃນຊ່ວງ */
  leads: number;
  /** ຄ່າໂຄສະນາຕໍ່ 1 ຄົນທັກໃນຊ່ວງດຽວກັນ (ກີບ) — 0 = ຍັງບໍ່ຮູ້ */
  costPerMessage: number;
  /** ຄ່າໂຄສະນາລາຍຊົ່ວໂມງ (ກີບ, 24 ຊ່ອງ) — null = ຍັງບໍ່ໄດ້ດຶງຜົນແຍກຊົ່ວໂມງ */
  spendByHour: number[] | null;
  /** ເບີທີ່ເຄີຍສັ່ງກ່ອນຊ່ວງນີ້ — ໃຊ້ຫາລູກຄ້າຊື້ຊ້ຳ */
  priorPhones: Set<string>;
};

// --------------------------------------------------------------- ຂໍ້ມູນອອກ

export type HourRow = {
  hour: number;
  threads: number;
  /** ສ່ວນແບ່ງຄົນທັກຂອງຊົ່ວໂມງນີ້ (0–1) */
  share: number;
  /** ສ່ວນແບ່ງຄ່າໂຄສະນາຂອງຊົ່ວໂມງນີ້ (0–1) — null ຖ້າຍັງບໍ່ມີຂໍ້ມູນ */
  spendShare: number | null;
};

export type BandRow = {
  band: string;
  threads: number;
  share: number;
  spendShare: number | null;
  /** ຄ່າກາງຂອງເວລາຕອບໃນຊ່ວງນີ້ (ນາທີ) */
  replyMedian: number | null;
};

export type WeekdayRow = {
  weekday: number;
  label: string;
  threads: number;
  share: number;
};

export type ReplyRow = {
  key: string;
  label: string;
  threads: number;
  share: number;
  /** ແຊັດທີ່ຜູກກັບລູກຄ້າແລ້ວ — ຖານຂອງອັດຕາປິດ */
  linked: number;
  /** ໃນນັ້ນ ຈຳນວນທີ່ກາຍເປັນອໍເດີ */
  ordered: number;
  /** ອັດຕາທີ່ກາຍເປັນອໍເດີ (ນັບສະເພາະແຊັດທີ່ຜູກແລ້ວ) */
  orderRate: number;
};

export type IntentRow = {
  key: string;
  label: string;
  /** ຈຳນວນແຊັດທີ່ຖາມເລື່ອງນີ້ */
  threads: number;
  share: number;
  /** ຄວນເອົາໄປແກ້ໃນໂຄສະນາແນວໃດ */
  hint: string;
};

export type LagRow = { label: string; orders: number; share: number };

export type FunnelStep = {
  label: string;
  value: number;
  /** ອັດຕາທຽບຂັ້ນກ່ອນໜ້າ (0–1) — null ສຳລັບຂັ້ນທຳອິດ */
  rate: number | null;
  /** ຂັ້ນນີ້ນັບຈາກຕາຕະລາງໃດ — ບອກໄວ້ເພາະບໍ່ໄດ້ມາຈາກແຫຼ່ງດຽວກັນໝົດ */
  source: string;
};

export type RepeatStat = {
  /** ຄົນທີ່ມີເບີ ແລະ ສັ່ງໃນຊ່ວງນີ້ */
  customers: number;
  /** ໃນນັ້ນ ຄົນທີ່ເຄີຍສັ່ງມາກ່ອນ ຫຼື ສັ່ງຫຼາຍກວ່າ 1 ເທື່ອ */
  repeat: number;
  rate: number;
  /** ອໍເດີທີ່ບໍ່ມີເບີ — ນັບບໍ່ໄດ້ ຈຶ່ງບອກໄວ້ */
  unknownPhone: number;
};

export type BehaviorReport = {
  threads: number;
  replied: number;
  unanswered: number;
  /** ຄ່າກາງຂອງເວລາຕອບ (ນາທີ) — null ຖ້າຍັງບໍ່ມີແຊັດທີ່ຕອບແລ້ວ */
  replyMedian: number | null;
  /** ແຊັດທີ່ຜູກກັບລູກຄ້າແລ້ວ */
  linked: number;
  hours: HourRow[];
  bands: BandRow[];
  weekdays: WeekdayRow[];
  replies: ReplyRow[];
  intents: IntentRow[];
  lag: LagRow[];
  /** ຄ່າກາງຂອງຈຳນວນວັນຈາກທັກຮອດຊື້ — null ຖ້າຂໍ້ມູນບໍ່ພຽງພໍ */
  lagMedian: number | null;
  funnel: FunnelStep[];
  repeat: RepeatStat;
  costPerMessage: number;
};

// --------------------------------------------------------------- ເກນຂັ້ນຕ່ຳ

/** ຄົນທັກໜ້ອຍກວ່ານີ້ = ຮູບແບບເວລາ/ຄຳຖາມ ຍັງເປັນຄວາມບັງເອີນ */
export const MIN_THREADS = 20;
/** ແຊັດທີ່ຜູກກັບລູກຄ້າແລ້ວ — ຖານຂອງອັດຕາປິດຕາມຄວາມໄວຕອບ */
export const MIN_LINKED = 15;
/** ອໍເດີຂັ້ນຕ່ຳກ່ອນຈະເວົ້າເລື່ອງໄລຍະຮອດການຊື້ */
export const MIN_ORDERS = 10;
/** ລູກຄ້າຂັ້ນຕ່ຳກ່ອນຈະເວົ້າເລື່ອງການຊື້ຊ້ຳ */
export const MIN_CUSTOMERS = 20;
/** ຕ່າງກັນເທົ່ານີ້ຂຶ້ນໄປຈຶ່ງຄຸ້ມທີ່ຈະລົງມື (ຄືກັບ `advice.ts`) */
const MEANINGFUL_GAP = 1.4;

// --------------------------------------------------------------- ຄຳຖາມທີ່ພົບ

/** ຕັດຊ່ອງຫວ່າງອອກໝົດ ເພາະຄົນລາວພິມ "ເທົ່າ ໃດ" ກັບ "ເທົ່າໃດ" ສະຫຼັບກັນ */
function norm(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "");
}

type IntentDef = { key: string; label: string; hint: string; words: string[] };

/**
 * ຄຳຖາມທີ່ລູກຄ້າຖາມກ່ອນ ຄື**ສິ່ງທີ່ໂຄສະນາຍັງບໍ່ໄດ້ຕອບ** —
 * ຍິ່ງຄົນຖາມເລື່ອງດຽວກັນຫຼາຍ ຍິ່ງຄວນເອົາຄຳຕອບນັ້ນໄປໃສ່ໃນຮູບ/ຂໍ້ຄວາມ
 * ເພື່ອບໍ່ໃຫ້ຈ່າຍຄ່າໂຄສະນາໃຫ້ຄົນທັກມາຖາມສິ່ງທີ່ບອກໄວ້ກ່ອນໄດ້.
 */
export const INTENTS: IntentDef[] = [
  {
    key: "price",
    label: "ຖາມລາຄາ",
    hint: "ໃສ່ລາຄາໃນຮູບ ຫຼື ແຖວທຳອິດຂອງຂໍ້ຄວາມໂຄສະນາ",
    words: ["ລາຄາ", "ເທົ່າໃດ", "ທໍ່ໃດ", "ຈັກກີບ", "ຈັກບາດ", "ราคา", "price"],
  },
  {
    key: "shipping",
    label: "ຖາມການສົ່ງ",
    hint: "ບອກຄ່າສົ່ງ ແລະ ຈຳນວນວັນທີ່ຮອດ ໄວ້ໃນໂຄສະນາ",
    words: ["ຄ່າສົ່ງ", "ຂົນສົ່ງ", "ສົ່ງເຖິງ", "ສົ່ງຮອດ", "ຕ່າງແຂວງ", "ຮັບເອງ", "ເດີນລົດ"],
  },
  {
    key: "stock",
    label: "ຖາມສີ / ຂະໜາດ / ຂອງເຫຼືອ",
    hint: "ໃສ່ສີ ແລະ ຂະໜາດທີ່ມີ ລົງໃນຮູບໂຄສະນາ",
    words: ["ມີສີ", "ສີໃດ", "ສີຫຍັງ", "ຂະໜາດ", "ໄຊ", "size", "ຍັງມີ", "ຂອງເຫຼືອ", "ສະຕັອກ"],
  },
  {
    key: "howtobuy",
    label: "ຖາມວິທີສັ່ງ / ຈ່າຍເງິນ",
    hint: "ບອກຂັ້ນຕອນສັ່ງ ແລະ ວິທີຈ່າຍ (ໂອນ / ເກັບປາຍທາງ) ໄວ້ໃນຂໍ້ຄວາມ",
    words: ["ວິທີສັ່ງ", "ສັ່ງແນວໃດ", "ໂອນ", "ຈ່າຍ", "ບັນຊີ", "bcel", "ປາຍທາງ", "cod"],
  },
  {
    key: "location",
    label: "ຖາມບ່ອນຢູ່ຮ້ານ",
    hint: "ໃສ່ທີ່ຕັ້ງ ຫຼື ລິ້ງແຜນທີ່ ໄວ້ໃນໂຄສະນາ",
    words: ["ຢູ່ໃສ", "ບ່ອນໃດ", "ທີ່ຢູ່", "ແຜນທີ່", "ສາຂາ", "location"],
  },
  {
    key: "discount",
    label: "ຂໍສ່ວນຫຼຸດ",
    hint: "ຄົນລໍໂປຣ — ຕັ້ງເງື່ອນໄຂສ່ວນຫຼຸດໃຫ້ຊັດ ຢ່າຫຼຸດເປັນລາຍຄົນ",
    words: ["ຫຼຸດ", "ຫລຸດ", "ໂປຣ", "ແຖມ", "ຖືກກວ່າ"],
  },
  {
    key: "buy",
    label: "ບອກວ່າຈະເອົາເລີຍ",
    hint: "ຄົນພ້ອມຊື້ — ຢ່າໃຫ້ລໍ ຕອບກ່ອນຫ້ອງອື່ນ",
    words: ["ຈະເອົາ", "ເອົາເລີຍ", "ຢາກໄດ້", "ສັ່ງເລີຍ", "ຈອງ", "ສົນໃຈ"],
  },
];

/** ຄຳຖາມທີ່ພົບໃນຂໍ້ຄວາມຊຸດໜຶ່ງ — 1 ແຊັດນັບ 1 ເທື່ອຕໍ່ເລື່ອງ */
export function detectIntents(texts: string[]): string[] {
  const joined = norm(texts.join(" "));
  if (!joined) return [];
  return INTENTS.filter((def) =>
    def.words.some((w) => joined.includes(norm(w))),
  ).map((def) => def.key);
}

// --------------------------------------------------------------- ຕົວຊ່ວຍ

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** ນາທີຈາກຄົນທັກຮອດເພຈຕອບ — null = ຍັງບໍ່ໄດ້ຕອບ */
export function replyMinutes(t: ThreadFact): number | null {
  if (!t.firstReplyAt) return null;
  const min = (t.firstReplyAt.getTime() - t.firstInboundAt.getTime()) / 60_000;
  return min >= 0 ? min : null;
}

/** ເບີໂທໃນຮູບແບບດຽວກັນ — ຄົນປ້ອນຂີດ/ຊ່ອງຫວ່າງບໍ່ຄືກັນ */
export function normalizePhone(phone: string | null): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 6 ? digits : null;
}

function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00.000Z`);
  const b = Date.parse(`${to}T00:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

// --------------------------------------------------------------- ຊຸດເວລາຕອບ

export const REPLY_BUCKETS = [
  { key: "m5", label: "ພາຍໃນ 5 ນາທີ", max: 5 },
  { key: "m30", label: "5–30 ນາທີ", max: 30 },
  { key: "h2", label: "30 ນາທີ – 2 ຊົ່ວໂມງ", max: 120 },
  { key: "h6", label: "2–6 ຊົ່ວໂມງ", max: 360 },
  { key: "late", label: "ເກີນ 6 ຊົ່ວໂມງ", max: Infinity },
  { key: "none", label: "ຍັງບໍ່ໄດ້ຕອບ", max: null },
] as const;

function replyBucketKey(minutes: number | null): string {
  if (minutes === null) return "none";
  return REPLY_BUCKETS.find((b) => b.max !== null && minutes <= b.max)!.key;
}

const LAG_BUCKETS = [
  { label: "ມື້ດຽວກັນ", max: 0 },
  { label: "1–3 ວັນ", max: 3 },
  { label: "4–7 ວັນ", max: 7 },
  { label: "ເກີນ 7 ວັນ", max: Infinity },
];

// --------------------------------------------------------------- ສ້າງລາຍງານ

export function buildBehaviorReport(input: BehaviorInput): BehaviorReport {
  const { threads, orders } = input;
  const total = threads.length;

  const replyMins = new Map<string, number | null>();
  for (const t of threads) replyMins.set(t.id, replyMinutes(t));

  const replied = threads.filter((t) => replyMins.get(t.id) !== null).length;
  const linked = threads.filter((t) => t.leadId).length;

  // ---- ຊົ່ວໂມງ ແລະ ຊ່ວງເວລາ
  const spendTotal = input.spendByHour?.reduce((a, b) => a + b, 0) ?? 0;
  const hourThreads = new Array(24).fill(0) as number[];
  for (const t of threads) hourThreads[laoHour(t.firstInboundAt)]++;

  const hours: HourRow[] = hourThreads.map((count, hour) => ({
    hour,
    threads: count,
    share: safeDiv(count, total),
    spendShare:
      input.spendByHour && spendTotal > 0
        ? safeDiv(input.spendByHour[hour] ?? 0, spendTotal)
        : null,
  }));

  const bandMap = new Map<string, { threads: number; spend: number; mins: number[] }>();
  for (let hour = 0; hour < 24; hour++) {
    const band = hourBand(hour);
    const cur = bandMap.get(band) ?? { threads: 0, spend: 0, mins: [] };
    cur.threads += hourThreads[hour];
    cur.spend += input.spendByHour?.[hour] ?? 0;
    bandMap.set(band, cur);
  }
  for (const t of threads) {
    const mins = replyMins.get(t.id);
    if (mins === null || mins === undefined) continue;
    bandMap.get(hourBand(laoHour(t.firstInboundAt)))!.mins.push(mins);
  }

  const bands: BandRow[] = [...bandMap.entries()]
    .map(([band, v]) => ({
      band,
      threads: v.threads,
      share: safeDiv(v.threads, total),
      spendShare: spendTotal > 0 ? safeDiv(v.spend, spendTotal) : null,
      replyMedian: median(v.mins),
    }))
    .sort((a, b) => b.threads - a.threads);

  // ---- ວັນໃນອາທິດ
  const weekdayCount = new Array(7).fill(0) as number[];
  for (const t of threads) weekdayCount[laoWeekday(t.firstInboundAt)]++;
  const weekdays: WeekdayRow[] = weekdayCount.map((count, weekday) => ({
    weekday,
    label: weekdayLao(weekday),
    threads: count,
    share: safeDiv(count, total),
  }));

  // ---- ຄວາມໄວຕອບ ແລະ ຜົນຂອງມັນ
  const byBucket = new Map<string, { threads: number; linked: number; ordered: number }>();
  for (const t of threads) {
    const key = replyBucketKey(replyMins.get(t.id) ?? null);
    const cur = byBucket.get(key) ?? { threads: 0, linked: 0, ordered: 0 };
    cur.threads++;
    if (t.leadId) {
      cur.linked++;
      if (t.ordered) cur.ordered++;
    }
    byBucket.set(key, cur);
  }
  const replies: ReplyRow[] = REPLY_BUCKETS.map((b) => {
    const v = byBucket.get(b.key) ?? { threads: 0, linked: 0, ordered: 0 };
    return {
      key: b.key,
      label: b.label,
      threads: v.threads,
      share: safeDiv(v.threads, total),
      linked: v.linked,
      ordered: v.ordered,
      orderRate: safeDiv(v.ordered, v.linked),
    };
  });

  // ---- ຄຳຖາມທີ່ພົບເລື້ອຍ
  const intentCount = new Map<string, number>();
  for (const t of threads) {
    for (const key of detectIntents(t.texts)) {
      intentCount.set(key, (intentCount.get(key) ?? 0) + 1);
    }
  }
  const intents: IntentRow[] = INTENTS.map((def) => ({
    key: def.key,
    label: def.label,
    hint: def.hint,
    threads: intentCount.get(def.key) ?? 0,
    share: safeDiv(intentCount.get(def.key) ?? 0, total),
  })).sort((a, b) => b.threads - a.threads);

  // ---- ທັກແລ້ວດົນປານໃດຈຶ່ງຊື້
  const lagDays = orders
    .filter((o) => o.leadDay)
    .map((o) => daysBetween(o.leadDay!, o.day))
    .filter((d) => d >= 0);
  const lagTotal = lagDays.length;
  const lag: LagRow[] = LAG_BUCKETS.map((b, i) => {
    const min = i === 0 ? -1 : LAG_BUCKETS[i - 1].max;
    const count = lagDays.filter((d) => d > min && d <= b.max).length;
    return { label: b.label, orders: count, share: safeDiv(count, lagTotal) };
  });

  // ---- ກວຍປ່ຽນ (ແຕ່ລະຂັ້ນມາຈາກຄົນລະຕາຕະລາງ ຈຶ່ງບອກແຫຼ່ງໄວ້)
  const delivered = orders.filter((o) => o.delivered).length;
  const funnel: FunnelStep[] = [
    { label: "ຄົນທັກເຂົ້າມາ", value: total, rate: null, source: "ຫ້ອງແຊັດ" },
    {
      label: "ເຮົາຕອບແລ້ວ",
      value: replied,
      rate: safeDiv(replied, total),
      source: "ຫ້ອງແຊັດ",
    },
    {
      label: "ບັນທຶກເປັນລູກຄ້າ",
      value: input.leads,
      rate: safeDiv(input.leads, replied),
      source: "ຕາຕະລາງລູກຄ້າ",
    },
    {
      label: "ສັ່ງຊື້",
      value: orders.length,
      rate: safeDiv(orders.length, input.leads),
      source: "ຕາຕະລາງອໍເດີ",
    },
    {
      label: "ສົ່ງສຳເລັດ",
      value: delivered,
      rate: safeDiv(delivered, orders.length),
      source: "ຕາຕະລາງອໍເດີ",
    },
  ];

  // ---- ລູກຄ້າຊື້ຊ້ຳ
  const seen = new Map<string, number>();
  let unknownPhone = 0;
  for (const o of orders) {
    const phone = normalizePhone(o.phone);
    if (!phone) {
      unknownPhone++;
      continue;
    }
    seen.set(phone, (seen.get(phone) ?? 0) + 1);
  }
  let repeatCount = 0;
  for (const [phone, count] of seen) {
    if (count > 1 || input.priorPhones.has(phone)) repeatCount++;
  }

  return {
    threads: total,
    replied,
    unanswered: total - replied,
    replyMedian: median(
      threads
        .map((t) => replyMins.get(t.id))
        .filter((m): m is number => m !== null && m !== undefined),
    ),
    linked,
    hours,
    bands,
    weekdays,
    replies,
    intents,
    lag,
    lagMedian: lagTotal >= MIN_ORDERS ? median(lagDays) : null,
    funnel,
    repeat: {
      customers: seen.size,
      repeat: repeatCount,
      rate: safeDiv(repeatCount, seen.size),
      unknownPhone,
    },
    costPerMessage: input.costPerMessage,
  };
}

// --------------------------------------------------------------- ຄຳແນະນຳ

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function minutesLao(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} ນາທີ`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)} ຊົ່ວໂມງ`;
  return `${(hours / 24).toFixed(1)} ວັນ`;
}

/** ງົບລົງບໍ່ກົງກັບເວລາທີ່ຄົນທັກຈິງ */
function adviseTiming(r: BehaviorReport): Advice[] {
  if (r.threads < MIN_THREADS) return [];
  const top = r.bands[0];
  if (!top || top.threads === 0) return [];

  // ຮູ້ງົບລາຍຊົ່ວໂມງ = ປຽບໄດ້ວ່າເງິນລົງກົງກັບຄວາມຕ້ອງການບໍ່
  if (top.spendShare !== null) {
    const gap = top.share - top.spendShare;
    if (gap >= 0.12) {
      return [
        {
          id: `shift:behavior:hour:${top.band}`,
          kind: "shift",
          title: `ຍ້າຍງົບໄປຊ່ວງ ${top.band}`,
          reason:
            `ຄົນທັກ ${pct(top.share)} ຂອງທັງໝົດເຂົ້າມາຊ່ວງ ${top.band} ` +
            `(${formatInt(top.threads)} ຫ້ອງ) ແຕ່ງົບລົງຊ່ວງນີ້ພຽງ ${pct(top.spendShare)}`,
          impact:
            "ຕັ້ງເວລາສະແດງໂຄສະນາໃນຊຸດໂຄສະນາ (ຕ້ອງໃຊ້ງົບລວມ) ຫຼື ຢ່າງໜ້ອຍຈັດຄົນຕອບໃຫ້ພໍຊ່ວງນີ້",
          confidence: confidenceFrom(r.threads, MIN_THREADS),
          sample: `${formatInt(r.threads)} ຫ້ອງແຊັດ`,
          href: "/analysis?kind=HOUR",
        },
      ];
    }
    return [];
  }

  // ບໍ່ຮູ້ງົບລາຍຊົ່ວໂມງ — ບອກໄດ້ແຕ່ວ່າຄົນທັກກະຈຸກຢູ່ຊ່ວງໃດ
  if (top.share < 0.35) return [];
  return [
    {
      id: `watch:behavior:hour:${top.band}`,
      kind: "watch",
      title: `ຄົນທັກກະຈຸກຢູ່ຊ່ວງ ${top.band}`,
      reason: `${pct(top.share)} ຂອງຄົນທັກ (${formatInt(top.threads)} ຫ້ອງ) ເຂົ້າມາຊ່ວງນີ້`,
      impact: "ຈັດຄົນຕອບໃຫ້ພໍຊ່ວງນີ້ ແລະ ພິຈາລະນາເລັ່ງງົບໃສ່ຊ່ວງດຽວກັນ",
      confidence: confidenceFrom(r.threads, MIN_THREADS),
      sample: `${formatInt(r.threads)} ຫ້ອງແຊັດ`,
      href: "/inbox?tab=chats",
    },
  ];
}

/** ຄົນທັກມາແລ້ວບໍ່ໄດ້ຕອບ = ຈ່າຍຄ່າໂຄສະນາຖິ້ມກັບບ່ອນ */
function adviseUnanswered(r: BehaviorReport, money: MoneyFn): Advice[] {
  if (r.threads < MIN_THREADS || r.unanswered < 5) return [];
  const share = safeDiv(r.unanswered, r.threads);
  if (share < 0.1) return [];

  const wasted = r.costPerMessage * r.unanswered;
  return [
    {
      id: "cut:behavior:unanswered",
      kind: "cut",
      title: `ມີ ${formatInt(r.unanswered)} ຄົນທັກທີ່ຍັງບໍ່ໄດ້ຕອບ`,
      reason:
        `${pct(share)} ຂອງຄົນທັກທັງໝົດ` +
        (r.costPerMessage > 0
          ? ` — ຄ່າໂຄສະນາທີ່ຈ່າຍໄປເພື່ອໃຫ້ເຂົາທັກມາປະມານ ${money(wasted)}`
          : ""),
      impact:
        "ຕອບໃຫ້ໝົດກ່ອນເພີ່ມງົບ — ເພີ່ມງົບຕອນຕອບບໍ່ທັນ ຄືການຈ່າຍເງິນເພີ່ມເພື່ອໃຫ້ຄົນລໍດົນຂຶ້ນ",
      confidence: confidenceFrom(r.unanswered, 5),
      sample: `${formatInt(r.threads)} ຫ້ອງແຊັດ · ຕອບແລ້ວ ${formatInt(r.replied)}`,
      href: "/inbox?tab=chats",
    },
  ];
}

/** ຕອບໄວແລ້ວປິດການຂາຍໄດ້ດີກວ່າແທ້ບໍ່ — ຕອບຈາກຂໍ້ມູນຂອງຮ້ານເອງ */
function adviseReplySpeed(r: BehaviorReport): Advice[] {
  if (r.linked < MIN_LINKED) return [];

  const fast = r.replies.filter((b) => b.key === "m5" || b.key === "m30");
  const slow = r.replies.filter((b) => b.key === "h6" || b.key === "late");
  const sum = (rows: ReplyRow[]) => ({
    linked: rows.reduce((a, b) => a + b.linked, 0),
    ordered: rows.reduce((a, b) => a + b.ordered, 0),
  });

  const f = sum(fast);
  const s = sum(slow);
  if (f.linked < 5 || s.linked < 5) return [];

  const fastRate = safeDiv(f.ordered, f.linked);
  const slowRate = safeDiv(s.ordered, s.linked);
  // ຕອບຊ້າແລ້ວປິດບໍ່ໄດ້ເລີຍ ຄືຄວາມຕ່າງທີ່ໃຫຍ່ທີ່ສຸດ — ຢ່າໃຫ້ການຫານດ້ວຍ 0 ກືນມັນໄປ
  if (fastRate <= 0) return [];
  if (slowRate > 0 && fastRate < slowRate * MEANINGFUL_GAP) return [];

  return [
    {
      id: "shift:behavior:reply-speed",
      kind: "shift",
      title: "ຕອບພາຍໃນ 30 ນາທີ ປິດການຂາຍໄດ້ດີກວ່າ",
      reason:
        `ຕອບໄວ ປິດໄດ້ ${pct(fastRate)} (${formatInt(f.linked)} ຫ້ອງ) · ` +
        `ຕອບຊ້າກວ່າ 2 ຊົ່ວໂມງ ປິດໄດ້ ${pct(slowRate)} (${formatInt(s.linked)} ຫ້ອງ)`,
      impact:
        "ຈັດຄົນຕອບໃຫ້ພໍໃນຊ່ວງທີ່ຄົນທັກຫຼາຍ ຄຸ້ມກວ່າການເພີ່ມງົບ ເພາະບໍ່ຕ້ອງຈ່າຍເພີ່ມຕໍ່ 1 ຄົນທັກ",
      confidence: confidenceFrom(f.linked + s.linked, MIN_LINKED),
      sample: `${formatInt(f.linked + s.linked)} ຫ້ອງທີ່ຜູກກັບລູກຄ້າແລ້ວ`,
      href: "/inbox?tab=chats",
    },
  ];
}

/** ຄຳຖາມທີ່ຊ້ຳກັນ = ສິ່ງທີ່ຄວນຍົກໄປໃສ່ໃນໂຄສະນາ */
function adviseIntents(r: BehaviorReport): Advice[] {
  if (r.threads < MIN_THREADS) return [];
  const top = r.intents[0];
  if (!top || top.share < 0.25) return [];

  return [
    {
      id: `shift:behavior:intent:${top.key}`,
      kind: "shift",
      title: `${pct(top.share)} ຂອງຄົນທັກ${top.label}`,
      reason: `${formatInt(top.threads)} ຫ້ອງ ໃນ ${formatInt(r.threads)} ຫ້ອງ ຖາມເລື່ອງດຽວກັນ`,
      impact: `${top.hint} — ຄົນທີ່ຖາມແລ້ວບໍ່ຊື້ ຄືຄ່າໂຄສະນາທີ່ຈ່າຍໄປໂດຍບໍ່ໄດ້ອັນໃດ`,
      confidence: confidenceFrom(top.threads, MIN_THREADS / 2),
      sample: `${formatInt(r.threads)} ຫ້ອງແຊັດ`,
      href: "/behavior",
    },
  ];
}

/** ດົນປານໃດຈຶ່ງຊື້ — ບອກວ່າຄວນຕິດຕາມ ແລະ ວັດຜົນຢູ່ຊ່ວງໃດ */
function adviseLag(r: BehaviorReport): Advice[] {
  if (r.lagMedian === null) return [];
  const sameDay = r.lag[0];
  const orders = r.lag.reduce((a, b) => a + b.orders, 0);
  if (orders < MIN_ORDERS) return [];

  return [
    {
      id: "info:behavior:lag",
      kind: "info",
      title:
        r.lagMedian <= 0
          ? "ສ່ວນຫຼາຍປິດການຂາຍໃນມື້ດຽວກັນ"
          : `ສ່ວນຫຼາຍປິດການຂາຍພາຍໃນ ${r.lagMedian} ວັນ`,
      reason:
        `${pct(sameDay.share)} ຂອງອໍເດີເກີດມື້ດຽວກັບທີ່ທັກ ` +
        `(ຄິດຈາກ ${formatInt(orders)} ອໍເດີທີ່ຜູກກັບລູກຄ້າ)`,
      impact:
        r.lagMedian <= 1
          ? "ຢ່າຫາກໍ່ຕັດແຄມເປນຈາກຍອດຂາຍພຽງ 1–2 ວັນ ແຕ່ຕິດຕາມຄົນທີ່ຍັງບໍ່ຕັດສິນໃຈພາຍໃນມື້ນັ້ນ"
          : `ວັດຜົນແຄມເປນຫຼັງຍິງແລ້ວຢ່າງໜ້ອຍ ${r.lagMedian + 1} ວັນ ແລະ ຕິດຕາມລູກຄ້າເກົ່າໃນຊ່ວງນັ້ນ`,
      confidence: confidenceFrom(orders, MIN_ORDERS),
      sample: `${formatInt(orders)} ອໍເດີ`,
      href: "/orders",
    },
  ];
}

/** ລູກຄ້າເກົ່າຊື້ຊ້ຳຫຼາຍ = ມີກຸ່ມເປົ້າໝາຍທີ່ຖືກກວ່າການຫາຄົນໃໝ່ */
function adviseRepeat(r: BehaviorReport): Advice[] {
  const { customers, repeat, rate } = r.repeat;
  if (customers < MIN_CUSTOMERS || rate < 0.15) return [];

  return [
    {
      id: "scale:behavior:repeat",
      kind: "scale",
      title: `ລູກຄ້າ ${pct(rate)} ກັບມາຊື້ຊ້ຳ`,
      reason: `${formatInt(repeat)} ໃນ ${formatInt(customers)} ເບີ ເຄີຍສັ່ງມາກ່ອນແລ້ວ`,
      impact:
        "ສົ່ງອອກລາຍຊື່ລູກຄ້າ (CSV) ໄປສ້າງ Custom Audience ໃນ Facebook ແລ້ວຍິງໃສ່ຄົນເກົ່າ — " +
        "ຄ່າຕໍ່ອໍເດີຖືກກວ່າການຫາຄົນໃໝ່ ແລະ ໃຊ້ສ້າງ Lookalike ໄດ້ອີກ",
      confidence: confidenceFrom(customers, MIN_CUSTOMERS),
      sample: `${formatInt(customers)} ເບີລູກຄ້າໃນຊ່ວງນີ້`,
      href: "/leads",
    },
  ];
}

/** ຊ່ວງທີ່ຄົນທັກຫຼາຍທີ່ສຸດ ແຕ່ຕອບຊ້າທີ່ສຸດ */
function adviseStaffing(r: BehaviorReport): Advice[] {
  if (r.threads < MIN_THREADS || r.replyMedian === null) return [];
  const top = r.bands[0];
  if (!top || top.replyMedian === null || top.threads < 10) return [];
  if (top.replyMedian < r.replyMedian * MEANINGFUL_GAP) return [];

  return [
    {
      id: `watch:behavior:staffing:${top.band}`,
      kind: "watch",
      title: `ຊ່ວງ ${top.band} ຄົນທັກຫຼາຍສຸດ ແຕ່ຕອບຊ້າສຸດ`,
      reason:
        `ຊ່ວງນີ້ຕອບຊ້າສະເລ່ຍ ${minutesLao(top.replyMedian)} ` +
        `ທຽບກັບຄ່າກາງທັງໝົດ ${minutesLao(r.replyMedian)} (${formatInt(top.threads)} ຫ້ອງ)`,
      impact: "ຍ້າຍຄົນຕອບມາຊ່ວງນີ້ ຫຼື ຕັ້ງຂໍ້ຄວາມຕອບອັດຕະໂນມັດໄວ້ກ່ອນ",
      confidence: confidenceFrom(top.threads, 10),
      sample: `${formatInt(top.threads)} ຫ້ອງ ໃນຊ່ວງ ${top.band}`,
      href: "/inbox?tab=chats",
    },
  ];
}

/**
 * ຄຳແນະນຳຈາກພຶດຕິກຳລູກຄ້າ — ຈັດລຳດັບແບບດຽວກັບ `advice.ts`
 * (ສິ່ງທີ່ຕ້ອງລົງມືກ່ອນ ແລ້ວຄ່ອຍເຖິງຂໍ້ສັງເກດ)
 */
export function adviseBehavior(r: BehaviorReport, money: MoneyFn): Advice[] {
  const all = [
    ...adviseUnanswered(r, money),
    ...adviseReplySpeed(r),
    ...adviseTiming(r),
    ...adviseIntents(r),
    ...adviseStaffing(r),
    ...adviseRepeat(r),
    ...adviseLag(r),
  ];

  const order: Advice["kind"][] = ["cut", "scale", "shift", "watch", "wait", "info"];
  const rank = (a: Advice) =>
    order.indexOf(a.kind) * 10 +
    ({ high: 0, medium: 1, low: 2 } as const)[a.confidence];
  return all.sort((a, b) => rank(a) - rank(b));
}

/** ມີຂໍ້ມູນພໍໃຫ້ສະແດງບໍ່ */
export function hasBehaviorData(r: BehaviorReport): boolean {
  return r.threads > 0 || r.funnel.some((s) => s.value > 0);
}
