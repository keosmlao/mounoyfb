import { confidenceFrom, type Advice } from "./advice-types";
import { detectIntents, INTENTS } from "./behavior";
import { allocateClaims, customerKey, type AllocClaim, type AllocItem } from "./live-cf";
import type { MoneyFn } from "./money";
import { sumOrderTotals, type OrderFinancialRow, type OrderTotals } from "./orders";
import { safeDiv } from "./format";

/**
 * ວິເຄາະຮອບ live — ບໍລິສຸດ (ຫ້າມ import prisma) · ມີ test ຄຸມ.
 * ການອ່ານຖານຂໍ້ມູນຢູ່ `live-server.ts` (`loadLiveAnalysis`).
 *
 * ຕົວເລກທັງໝົດມາຈາກຂໍ້ມູນຝັ່ງເຮົາ (comment/CF/ບິນ) — ບໍ່ມີຍອດຄົນເບິ່ງຂອງ Facebook
 * ຈຶ່ງວັດ "ຄົນທີ່ມີສ່ວນຮ່ວມ" ບໍ່ແມ່ນ "ຄົນທີ່ເຫັນ".
 */

// ------------------------------------------------------------------ ຂໍ້ມູນເຂົ້າ

export type AnalysisComment = {
  fbCommentId: string;
  parentFbId: string | null;
  fromId: string | null;
  fromName: string | null;
  fromPage: boolean;
  message: string | null;
  commentedAt: Date;
  isCf: boolean;
  isQuestion: boolean;
  handled: boolean;
};

export type AnalysisClaim = AllocClaim & {
  fromId: string | null;
  fromName: string | null;
  cancelReason: string | null;
};

export type AnalysisItem = AllocItem & {
  code: string;
  name: string;
  price: number;
};

export type AnalysisOrder = OrderFinancialRow & { notifiedAt: Date | null };

/** ຍອດຂອງ live ກ່ອນໆ — ໃຊ້ປຽບທຽບວ່າຮອບນີ້ດີ ຫຼື ແຍ່ກວ່າປົກກະຕິ */
export type PastLive = { reservedValue: number; cfCustomers: number; viewers: number | null };

/** ຈຸດຍອດຄົນເບິ່ງຈາກ Facebook — ຄ່າສະສົມນັບແຕ່ເລີ່ມ live */
export type AnalysisStat = {
  at: Date;
  views: number | null;
  viewers: number | null;
  avgWatchMs: number | null;
  reactions: number | null;
};

/** ການ boost — spend ເປັນສະກຸນຂອງບັນຊີ ແປງເປັນກີບດ້ວຍອັດຕາຕອນສ້າງ (budgetLak/budget) */
export type AnalysisBoost = { spend: number | null; budget: number; budgetLak: number; reach: number | null };

export type LiveAnalysisInput = {
  comments: readonly AnalysisComment[];
  claims: readonly AnalysisClaim[];
  items: readonly AnalysisItem[];
  orders: readonly AnalysisOrder[];
  past: readonly PastLive[];
  autoAck: boolean;
  stats: readonly AnalysisStat[];
  boosts: readonly AnalysisBoost[];
};

// ------------------------------------------------------------------ ຜົນ

export type ItemStat = {
  id: string;
  code: string;
  name: string;
  stock: number | null;
  reserved: number;
  waitlist: number;
  /** ຈອງໄດ້ / ຈຳນວນທີ່ມີ — null ເມື່ອບໍ່ຈຳກັດ */
  sellThrough: number | null;
  /** ນາທີນັບຈາກ comment ທຳອິດຂອງ live ຮອດຕອນຂອງໝົດ */
  soldOutMinute: number | null;
  reservedValue: number;
  /** ມູນຄ່າທີ່ພາດ ເພາະຂອງໝົດແຕ່ຍັງມີຄົນລໍ */
  missedValue: number;
  cfCount: number;
};

export type TimeBucket = { label: string; comments: number; cf: number };

export type LiveAnalysis = {
  minutes: number;
  comments: number;
  commenters: number;
  commentsPerMinute: number;
  cfComments: number;
  cfCustomers: number;
  /** ຄົນທີ່ CF / ຄົນທີ່ comment */
  conversion: number;
  reservedQty: number;
  reservedValue: number;
  waitlistQty: number;
  missedValue: number;
  unmatched: number;
  duplicates: number;
  items: ItemStat[];
  questions: number;
  answered: number;
  answerRate: number;
  /** ນາທີກາງ ຈາກຄຳຖາມຮອດເພຈຕອບໃຕ້ comment */
  medianReplyMinutes: number | null;
  intents: { key: string; label: string; count: number }[];
  timeline: TimeBucket[];
  bucketMinutes: number;
  peak: TimeBucket | null;
  /** ສັດສ່ວນ CF ໃນ 25% ສຸດທ້າຍຂອງເວລາ live */
  lateCfShare: number;
  funnel: {
    billed: number;
    notified: number;
    confirmed: number;
    delivered: number;
    cancelled: number;
  };
  money: OrderTotals;
  /** ຍອດຈອງຂອງຮອບນີ້ ທຽບຄ່າສະເລ່ຍຂອງ live ກ່ອນໆ (1.2 = ດີກວ່າ 20%) */
  vsPast: number | null;
  audience: {
    /** ຄົນເບິ່ງ (ບໍ່ນັບຊ້ຳ) — null = Facebook ຍັງບໍ່ໃຫ້ຂໍ້ມູນ */
    viewers: number | null;
    views: number | null;
    avgWatchSeconds: number | null;
    reactions: number | null;
    /** ຄົນ comment / ຄົນເບິ່ງ */
    engagementRate: number | null;
    /** ຄົນ CF / ຄົນເບິ່ງ */
    cfRate: number | null;
    /** ຍອດຈອງ / ຄົນເບິ່ງ (ກີບ) */
    valuePerViewer: number | null;
    /** ຄົນເບິ່ງສະສົມຕາມເວລາ */
    timeline: { at: Date; viewers: number }[];
    checkedAt: Date | null;
    vsPast: number | null;
  };
  boost: {
    spendLak: number;
    reach: number;
    /** ຍອດຈອງ / ຄ່າໂຄສະນາ */
    bookedRoas: number | null;
    /** ຍອດຂາຍຈິງ (ຮັບສຳເລັດ) / ຄ່າໂຄສະນາ */
    actualRoas: number | null;
    costPerCfCustomer: number | null;
  } | null;
};

// ------------------------------------------------------------------ ເກນ

/** ຄົນ comment ໜ້ອຍກວ່ານີ້ = ອັດຕາສ່ວນຍັງເປັນຄວາມບັງເອີນ */
export const MIN_COMMENTERS = 20;
/** CF ໜ້ອຍກວ່ານີ້ = ຍັງບໍ່ເວົ້າເລື່ອງສິນຄ້າໃດຂາຍບໍ່ອອກ */
export const MIN_CF = 10;
/** ຄຳຖາມຂັ້ນຕ່ຳກ່ອນເວົ້າເລື່ອງການຕອບ */
export const MIN_QUESTIONS = 5;
/** ບິນຂັ້ນຕ່ຳກ່ອນເວົ້າເລື່ອງອັດຕາຍົກເລີກ */
export const MIN_BILLS = 10;
/** live ກ່ອນໆຂັ້ນຕ່ຳກ່ອນປຽບທຽບ */
export const MIN_PAST = 3;
/** ຄົນເບິ່ງຂັ້ນຕ່ຳກ່ອນເວົ້າເລື່ອງອັດຕາສ່ວນຮ່ວມ/ເວລາເບິ່ງ */
export const MIN_VIEWERS = 200;
/** ຄ່າ boost ຂັ້ນຕ່ຳ (ກີບ) ກ່ອນຕັດສິນວ່າຄຸ້ມບໍ່ — ໜ້ອຍກວ່ານີ້ຍັງເປັນຄວາມບັງເອີນ */
export const MIN_BOOST_SPEND_LAK = 100_000;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// ------------------------------------------------------------------ ຄິດ

export function analyzeLive(input: LiveAnalysisInput): LiveAnalysis {
  const customerComments = input.comments.filter((c) => !c.fromPage);
  const times = customerComments.map((c) => c.commentedAt.getTime());
  const start = times.length ? Math.min(...times) : 0;
  const end = times.length ? Math.max(...times) : 0;
  const minutes = times.length ? Math.max(1, Math.round((end - start) / 60_000)) : 0;

  const commenters = new Set(customerComments.map((c) => customerKey(c.fromId, c.fromName)));

  // ---- CF ແລະ ສິນຄ້າ
  const allocation = allocateClaims(input.items, input.claims);
  const cfCustomers = new Set(
    input.claims
      .filter((c) => allocation.state.get(c.id) !== "UNMATCHED")
      .map((c) => customerKey(c.fromId, c.fromName)),
  );

  const items: ItemStat[] = input.items.map((item) => {
    const count = allocation.items.get(item.id) ?? { reserved: 0, waitlist: 0, left: item.stock };
    const mine = input.claims
      .filter((c) => c.itemId === item.id)
      .sort((a, b) => a.commentedAt.getTime() - b.commentedAt.getTime());

    // ຂອງໝົດຕອນໃດ — ໄລ່ລາຍການທີ່ຈອງໄດ້ຕາມເວລາ ຈົນຄົບຈຳນວນ
    let soldOutMinute: number | null = null;
    if (item.stock !== null && item.stock > 0 && count.left === 0) {
      let taken = 0;
      for (const claim of mine) {
        if (allocation.state.get(claim.id) !== "RESERVED") continue;
        taken += claim.quantity;
        if (taken >= item.stock) {
          soldOutMinute = Math.round((claim.commentedAt.getTime() - start) / 60_000);
          break;
        }
      }
    }

    return {
      id: item.id,
      code: item.code,
      name: item.name,
      stock: item.stock,
      reserved: count.reserved,
      waitlist: count.waitlist,
      sellThrough: item.stock ? count.reserved / item.stock : null,
      soldOutMinute,
      reservedValue: count.reserved * item.price,
      missedValue: count.waitlist * item.price,
      cfCount: mine.filter((c) => !c.cancelled).length,
    };
  });

  const states = [...allocation.state.values()];
  const unmatched = states.filter((s) => s === "UNMATCHED").length;
  const duplicates = input.claims.filter((c) => c.cancelled && c.cancelReason === "CF ຊ້ຳ").length;

  // ---- ຄຳຖາມ
  const questions = customerComments.filter((c) => c.isQuestion);
  const pageReplies = new Map<string, Date>();
  for (const c of input.comments) {
    if (!c.fromPage || !c.parentFbId) continue;
    const old = pageReplies.get(c.parentFbId);
    if (!old || c.commentedAt < old) pageReplies.set(c.parentFbId, c.commentedAt);
  }
  const answered = questions.filter((q) => pageReplies.has(q.fbCommentId) || q.handled);
  const replyMinutes = questions
    .map((q) => {
      const at = pageReplies.get(q.fbCommentId);
      return at ? (at.getTime() - q.commentedAt.getTime()) / 60_000 : null;
    })
    .filter((m): m is number => m !== null && m >= 0);

  const intentCount = new Map<string, number>();
  for (const q of questions) {
    for (const key of detectIntents([q.message ?? ""])) {
      if (key !== "buy") intentCount.set(key, (intentCount.get(key) ?? 0) + 1);
    }
  }
  const intents = INTENTS.filter((d) => intentCount.has(d.key))
    .map((d) => ({ key: d.key, label: d.label, count: intentCount.get(d.key)! }))
    .sort((a, b) => b.count - a.count);

  // ---- ເສັ້ນເວລາ — live ຍາວກໍ່ບໍ່ໃຫ້ຖັນເກີນ ~24 ຊ່ອງ
  const bucketMinutes = minutes <= 60 ? 5 : minutes <= 180 ? 10 : 30;
  const bucketCount = times.length ? Math.floor(minutes / bucketMinutes) + 1 : 0;
  const timeline: TimeBucket[] = Array.from({ length: bucketCount }, (_, i) => ({
    label: `${pad(Math.floor((i * bucketMinutes) / 60))}:${pad((i * bucketMinutes) % 60)}`,
    comments: 0,
    cf: 0,
  }));
  const bucketOf = (at: Date) =>
    Math.min(bucketCount - 1, Math.floor((at.getTime() - start) / 60_000 / bucketMinutes));
  for (const c of customerComments) {
    const bucket = timeline[bucketOf(c.commentedAt)];
    bucket.comments++;
    if (c.isCf) bucket.cf++;
  }
  const peak = timeline.reduce<TimeBucket | null>(
    (best, b) => (b.cf > 0 && (!best || b.cf > best.cf) ? b : best),
    null,
  );

  const cfTimes = customerComments.filter((c) => c.isCf).map((c) => c.commentedAt.getTime());
  const lateFrom = start + (end - start) * 0.75;
  const lateCfShare = safeDiv(cfTimes.filter((t) => t >= lateFrom).length, cfTimes.length);

  // ---- ບິນ
  const billed = input.orders.length;
  const funnel = {
    billed,
    notified: input.orders.filter((o) => o.notifiedAt).length,
    confirmed: input.orders.filter((o) =>
      ["CONFIRMED", "SHIPPED", "DELIVERED"].includes(o.status),
    ).length,
    delivered: input.orders.filter((o) => o.status === "DELIVERED").length,
    cancelled: input.orders.filter((o) => o.status === "CANCELLED" || o.status === "RETURNED").length,
  };

  const reservedValue = items.reduce((s, i) => s + i.reservedValue, 0);
  const pastAvg = input.past.length
    ? input.past.reduce((s, p) => s + p.reservedValue, 0) / input.past.length
    : 0;

  // ---- ຄົນເບິ່ງ (Facebook) — ເອົາຈຸດຫຼ້າສຸດທີ່ມີຄ່າ
  const stats = [...input.stats].sort((a, b) => a.at.getTime() - b.at.getTime());
  const latest = <K extends keyof AnalysisStat>(key: K) =>
    [...stats].reverse().find((s) => s[key] !== null)?.[key] ?? null;
  const viewers = latest("viewers") as number | null;
  const avgWatchMs = latest("avgWatchMs") as number | null;
  const pastViewers = input.past.map((p) => p.viewers).filter((v): v is number => v !== null && v > 0);
  const money = sumOrderTotals(input.orders);

  // ---- boost
  const spendLak = input.boosts.reduce(
    (sum, b) => sum + (b.spend && b.budget > 0 ? (b.spend / b.budget) * b.budgetLak : 0),
    0,
  );

  return {
    minutes,
    comments: customerComments.length,
    commenters: commenters.size,
    commentsPerMinute: safeDiv(customerComments.length, minutes),
    cfComments: customerComments.filter((c) => c.isCf).length,
    cfCustomers: cfCustomers.size,
    conversion: safeDiv(cfCustomers.size, commenters.size),
    reservedQty: items.reduce((s, i) => s + i.reserved, 0),
    reservedValue,
    waitlistQty: items.reduce((s, i) => s + i.waitlist, 0),
    missedValue: items.reduce((s, i) => s + i.missedValue, 0),
    unmatched,
    duplicates,
    items,
    questions: questions.length,
    answered: answered.length,
    answerRate: safeDiv(answered.length, questions.length),
    medianReplyMinutes: median(replyMinutes),
    intents,
    timeline,
    bucketMinutes,
    peak,
    lateCfShare,
    funnel,
    money,
    vsPast: input.past.length >= MIN_PAST && pastAvg > 0 ? reservedValue / pastAvg : null,
    audience: {
      viewers,
      views: latest("views") as number | null,
      avgWatchSeconds: avgWatchMs === null ? null : avgWatchMs / 1000,
      reactions: latest("reactions") as number | null,
      engagementRate: viewers ? commenters.size / viewers : null,
      cfRate: viewers ? cfCustomers.size / viewers : null,
      valuePerViewer: viewers ? reservedValue / viewers : null,
      timeline: stats
        .filter((s) => s.viewers !== null)
        .map((s) => ({ at: s.at, viewers: s.viewers! })),
      checkedAt: stats.at(-1)?.at ?? null,
      vsPast:
        viewers && pastViewers.length >= MIN_PAST
          ? viewers / (pastViewers.reduce((a, b) => a + b, 0) / pastViewers.length)
          : null,
    },
    boost: input.boosts.length
      ? {
          spendLak,
          reach: input.boosts.reduce((sum, b) => sum + (b.reach ?? 0), 0),
          bookedRoas: spendLak > 0 ? reservedValue / spendLak : null,
          actualRoas: spendLak > 0 ? money.netRevenue / spendLak : null,
          costPerCfCustomer: spendLak > 0 && cfCustomers.size > 0 ? spendLak / cfCustomers.size : null,
        }
      : null,
  };
}

// ------------------------------------------------------------------ ຄຳແນະນຳ

const pct = (v: number) => `${Math.round(v * 100)}%`;

/**
 * ຄຳແນະນຳສຳລັບ live ຮອບຕໍ່ໄປ — ທຸກຂໍ້ມີເກນຂໍ້ມູນຂັ້ນຕ່ຳ (ຄືກັບ `advice.ts`)
 * ບໍ່ດັ່ງນັ້ນ live ທີ່ມີຄົນ comment 3 ຄົນຈະຖືກສະຫຼຸບຜິດໆ.
 */
export function adviseLive(a: LiveAnalysis, money: MoneyFn, autoAck: boolean): Advice[] {
  const out: Advice[] = [];

  // ຂອງໝົດໄວ ມີຄົນລໍ = ຄວາມຕ້ອງການເກີນ
  for (const item of a.items) {
    if (item.soldOutMinute === null || item.waitlist < 3) continue;
    out.push({
      id: `live-soldout-${item.id}`,
      kind: "scale",
      title: `${item.code} ${item.name}: ຮອບໜ້າເພີ່ມຈຳນວນ ຫຼື ລອງຂຶ້ນລາຄາ`,
      reason: `ໝົດພາຍໃນ ${item.soldOutMinute} ນາທີ ແລະ ຍັງມີຄົນລໍ ${item.waitlist} ຊິ້ນ`,
      impact: `ຍອດທີ່ພາດເພາະຂອງບໍ່ພໍ ${money(item.missedValue)}`,
      confidence: confidenceFrom(item.waitlist, 3),
      sample: `CF ${item.cfCount} ລາຍການ`,
    });
  }

  // ສິນຄ້າທີ່ບໍ່ມີຄົນເອົາ — ເວົ້າໄດ້ເມື່ອ live ມີ CF ພໍ (ບໍ່ແມ່ນ live ຮ້າງທັງຮອບ)
  const totalCf = a.items.reduce((s, i) => s + i.cfCount, 0);
  if (totalCf >= MIN_CF) {
    for (const item of a.items) {
      if (item.cfCount === 0) {
        out.push({
          id: `live-nocf-${item.id}`,
          kind: "cut",
          title: `${item.code} ${item.name}: ບໍ່ມີຄົນ CF ເລີຍ`,
          reason: `ສິນຄ້າອື່ນໃນ live ດຽວກັນມີ CF ລວມ ${totalCf} ລາຍການ`,
          impact: "ປ່ຽນວິທີນຳສະເໜີ/ລາຄາ ຫຼື ເອົາອອກຈາກ live ຮອບໜ້າ ເພື່ອປະຢັດເວລາ",
          confidence: confidenceFrom(totalCf, MIN_CF),
          sample: `CF ທັງ live ${totalCf}`,
        });
      } else if (item.sellThrough !== null && item.sellThrough < 0.3 && item.stock! >= 5) {
        out.push({
          id: `live-slow-${item.id}`,
          kind: "watch",
          title: `${item.code} ${item.name}: ຂາຍໄດ້ພຽງ ${pct(item.sellThrough)} ຂອງທີ່ມີ`,
          reason: `ຈອງ ${item.reserved} ຈາກ ${item.stock} ຊິ້ນ`,
          impact: "ຮອບໜ້າເອົາມາໜ້ອຍລົງ ຫຼື ຈັດເປັນຊຸດກັບສິນຄ້າທີ່ຂາຍດີ",
          confidence: confidenceFrom(totalCf, MIN_CF),
          sample: `CF ທັງ live ${totalCf}`,
        });
      }
    }
  }

  // ຄົນ comment ຫຼາຍແຕ່ CF ໜ້ອຍ
  if (a.commenters >= MIN_COMMENTERS && a.conversion < 0.15) {
    const price = a.intents.find((i) => i.key === "price");
    out.push({
      id: "live-conversion",
      kind: "shift",
      title: "ຄົນມີສ່ວນຮ່ວມຫຼາຍ ແຕ່ CF ໜ້ອຍ — ບອກລະຫັດ ແລະ ລາຄາໃຫ້ຊັດຂຶ້ນ",
      reason: `ຄົນ comment ${a.commenters} ຄົນ ແຕ່ CF ພຽງ ${a.cfCustomers} ຄົນ (${pct(a.conversion)})`,
      impact: price
        ? `ມີຄົນຖາມລາຄາ ${price.count} ເທື່ອ — ຂຽນລະຫັດ+ລາຄາໃສ່ປ້າຍໃຫ້ເຫັນຕະຫຼອດ ແລະ ບອກວິທີ CF ຊ້ຳທຸກ 10 ນາທີ`
        : "ບອກວິທີ CF ຊ້ຳທຸກ 10 ນາທີ ແລະ ຂຽນລະຫັດສິນຄ້າໃຫ້ເຫັນຊັດໃນຈໍ",
      confidence: confidenceFrom(a.commenters, MIN_COMMENTERS),
      sample: `${a.commenters} ຄົນ comment`,
    });
  }

  // ຄຳຖາມບໍ່ໄດ້ຕອບ — ຄົນຖາມແລ້ວບໍ່ໄດ້ຄຳຕອບ ມັກບໍ່ CF
  if (a.questions >= MIN_QUESTIONS && a.answerRate < 0.6) {
    out.push({
      id: "live-unanswered",
      kind: "shift",
      title: "ມີແອັດມິນຊ່ວຍຕອບ comment ລະຫວ່າງ live",
      reason: `ຕອບໄດ້ ${a.answered} ຈາກ ${a.questions} ຄຳຖາມ (${pct(a.answerRate)})`,
      impact: a.intents[0]
        ? `ຄຳຖາມທີ່ພົບຫຼາຍສຸດ: ${a.intents[0].label} ${a.intents[0].count} ເທື່ອ — ຕັ້ງຄຳຕອບສຳເລັດຮູບໄວ້ລ່ວງໜ້າ`
        : "ຕັ້ງຄຳຕອບສຳເລັດຮູບໄວ້ລ່ວງໜ້າ",
      confidence: confidenceFrom(a.questions, MIN_QUESTIONS),
      sample: `${a.questions} ຄຳຖາມ`,
    });
  }

  // ຊ່ວງທ້າຍແທບບໍ່ມີ CF
  if (a.minutes >= 40 && a.cfComments >= MIN_CF && a.lateCfShare < 0.1) {
    out.push({
      id: "live-late",
      kind: "shift",
      title: "ຊ່ວງທ້າຍແທບບໍ່ມີ CF — live ໃຫ້ສັ້ນລົງ ຫຼື ເກັບສິນຄ້າເດັ່ນໄວ້ທ້າຍ",
      reason: `CF ໃນ 25% ສຸດທ້າຍຂອງເວລາມີພຽງ ${pct(a.lateCfShare)} (live ${a.minutes} ນາທີ)`,
      impact: a.peak ? `CF ຫຼາຍສຸດຊ່ວງນາທີ ${a.peak.label} (${a.peak.cf} CF)` : undefined,
      confidence: confidenceFrom(a.cfComments, MIN_CF),
      sample: `${a.cfComments} CF`,
    });
  }

  // ພິມລະຫັດຜິດ / CF ຊ້ຳ
  if (a.cfComments >= MIN_CF && safeDiv(a.unmatched, a.cfComments) > 0.1) {
    out.push({
      id: "live-unmatched",
      kind: "watch",
      title: "ລູກຄ້າພິມລະຫັດຜິດຫຼາຍ — ສະແດງລະຫັດໃຫ້ເຫັນຊັດ",
      reason: `CF ທີ່ອ່ານລະຫັດບໍ່ອອກ ${a.unmatched} ຈາກ ${a.cfComments} (${pct(safeDiv(a.unmatched, a.cfComments))})`,
      impact: "ໃຊ້ລະຫັດສັ້ນ (A1, B2) ຂຽນຕິດສິນຄ້າ ແລະ ອ່ານອອກສຽງທຸກເທື່ອທີ່ຍົກສິນຄ້າ",
      confidence: confidenceFrom(a.cfComments, MIN_CF),
      sample: `${a.cfComments} CF`,
    });
  }
  if (!autoAck && a.cfComments >= MIN_CF && safeDiv(a.duplicates, a.cfComments) > 0.15) {
    out.push({
      id: "live-duplicates",
      kind: "watch",
      title: "CF ຊ້ຳຫຼາຍ — ເປີດ “ຕອບຮັບ CF ອັດຕະໂນມັດ”",
      reason: `CF ຊ້ຳ ${a.duplicates} ຈາກ ${a.cfComments} — ລູກຄ້າບໍ່ແນ່ໃຈວ່າຈອງໄດ້ແລ້ວ`,
      confidence: confidenceFrom(a.cfComments, MIN_CF),
      sample: `${a.cfComments} CF`,
    });
  }

  // ບິນ
  const unnotified = a.funnel.billed - a.funnel.notified;
  if (unnotified > 0) {
    out.push({
      id: "live-notify",
      kind: "watch",
      title: `ຍັງບໍ່ໄດ້ສົ່ງສະຫຼຸບຍອດ ${unnotified} ບິນ`,
      reason: "ລູກຄ້າທີ່ບໍ່ໄດ້ຮັບຍອດພາຍໃນມື້ ມັກລືມ ຫຼື ໄປຊື້ບ່ອນອື່ນ",
      impact: "ກົດ “ສົ່ງສະຫຼຸບຍອດ” ຢູ່ໜ້າ live",
      confidence: "high",
      sample: `${a.funnel.billed} ບິນ`,
    });
  }
  if (a.funnel.billed >= MIN_BILLS && safeDiv(a.funnel.cancelled, a.funnel.billed) >= 0.2) {
    out.push({
      id: "live-cancel",
      kind: "cut",
      title: "CF ແລ້ວບໍ່ເອົາ/ຕີກັບຫຼາຍ — ຂໍຢືນຢັນ ຫຼື ມັດຈຳໄວຂຶ້ນ",
      reason: `ຍົກເລີກ/ຕີກັບ ${a.funnel.cancelled} ຈາກ ${a.funnel.billed} ບິນ (${pct(safeDiv(a.funnel.cancelled, a.funnel.billed))})`,
      impact: "ສົ່ງສະຫຼຸບຍອດທັນທີຫຼັງ live ແລະ ກຳນົດເວລາຢືນຢັນ ບໍ່ດັ່ງນັ້ນປ່ອຍຂອງໃຫ້ຄິວຖັດໄປ",
      confidence: confidenceFrom(a.funnel.billed, MIN_BILLS),
      sample: `${a.funnel.billed} ບິນ`,
    });
  }

  // ທຽບກັບ live ກ່ອນໆ
  if (a.vsPast !== null && Math.abs(a.vsPast - 1) >= 0.3) {
    const better = a.vsPast > 1;
    out.push({
      id: "live-vs-past",
      kind: better ? "info" : "watch",
      title: better
        ? `ຍອດຈອງສູງກວ່າ live ປົກກະຕິ ${pct(a.vsPast - 1)} — ຈົດໄວ້ວ່າຮອບນີ້ເຮັດຫຍັງຕ່າງ`
        : `ຍອດຈອງຕ່ຳກວ່າ live ປົກກະຕິ ${pct(1 - a.vsPast)}`,
      reason: `ຮອບນີ້ ${money(a.reservedValue)} (ທຽບຄ່າສະເລ່ຍຂອງ live ກ່ອນໜ້າ)`,
      impact: better ? "ເວລາ, ສິນຄ້າ ຫຼື ວິທີນຳສະເໜີ — ເຮັດຊ້ຳໃນຮອບໜ້າ" : "ກວດເວລາເລີ່ມ live ແລະ ຊຸດສິນຄ້າທຽບກັບຮອບທີ່ດີ",
      confidence: "medium",
      sample: "live ກ່ອນໜ້າ",
    });
  }

  // ຄົນເບິ່ງຫຼາຍ ແຕ່ບໍ່ມີສ່ວນຮ່ວມ
  const au = a.audience;
  if (au.viewers !== null && au.viewers >= MIN_VIEWERS && au.engagementRate !== null && au.engagementRate < 0.03) {
    out.push({
      id: "live-engagement",
      kind: "shift",
      title: "ຄົນເບິ່ງຫຼາຍ ແຕ່ comment ໜ້ອຍ — ຊວນໃຫ້ comment ຕະຫຼອດ live",
      reason: `ຄົນເບິ່ງ ${au.viewers.toLocaleString("en-US")} ຄົນ ແຕ່ comment ພຽງ ${a.commenters} ຄົນ (${pct(au.engagementRate)})`,
      impact: "ຖາມຄຳຖາມງ່າຍໆໃຫ້ຕອບ, ແຈກລາງວັນໃຫ້ຄົນ comment, ບອກວ່າ CF ກ່ອນໄດ້ກ່ອນ",
      confidence: confidenceFrom(au.viewers, MIN_VIEWERS),
      sample: `${au.viewers.toLocaleString("en-US")} ຄົນເບິ່ງ`,
    });
  }
  if (au.viewers !== null && au.viewers >= MIN_VIEWERS && au.avgWatchSeconds !== null && au.avgWatchSeconds < 60) {
    out.push({
      id: "live-watchtime",
      kind: "watch",
      title: `ຄົນເບິ່ງສະເລ່ຍພຽງ ${Math.round(au.avgWatchSeconds)} ວິນາທີ — ຕ້ອງດຶງໃຫ້ຢູ່ຕັ້ງແຕ່ນາທີທຳອິດ`,
      reason: "ຄົນສ່ວນຫຼາຍເລື່ອນຜ່ານກ່ອນເຫັນສິນຄ້າ",
      impact: "ເປີດ live ດ້ວຍສິນຄ້າເດັ່ນ/ລາຄາພິເສດ ແລະ ບອກລະຫັດ CF ທັນທີ ບໍ່ຕ້ອງລໍຄົນເຂົ້າ",
      confidence: confidenceFrom(au.viewers, MIN_VIEWERS),
      sample: `${au.viewers.toLocaleString("en-US")} ຄົນເບິ່ງ`,
    });
  }

  // boost ຄຸ້ມບໍ່ — ວັດຈາກຍອດຈອງ (ຍອດຂາຍຈິງມາຊ້າຫຼາຍມື້)
  if (a.boost && a.boost.spendLak >= MIN_BOOST_SPEND_LAK && a.boost.bookedRoas !== null) {
    const roas = a.boost.bookedRoas;
    if (roas < 3) {
      out.push({
        id: "live-boost-poor",
        kind: "cut",
        title: `boost ບໍ່ຄຸ້ມ — ຍອດຈອງໄດ້ພຽງ ${roas.toFixed(1)} ເທົ່າຂອງຄ່າໂຄສະນາ`,
        reason: `ຄ່າ boost ${money(a.boost.spendLak)} · ຍອດຈອງ ${money(a.reservedValue)}`,
        impact: "ຮອບໜ້າຫຼຸດງົບ, ບີບອາຍຸ/ເພດໃຫ້ຕົງລູກຄ້າ ຫຼື boost ສະເພາະຊ່ວງທີ່ມີສິນຄ້າເດັ່ນ",
        confidence: confidenceFrom(a.boost.spendLak, MIN_BOOST_SPEND_LAK),
        sample: `ຄ່າ boost ${money(a.boost.spendLak)}`,
      });
    } else if (roas >= 6) {
      out.push({
        id: "live-boost-good",
        kind: "scale",
        title: `boost ຄຸ້ມ — ຍອດຈອງ ${roas.toFixed(1)} ເທົ່າຂອງຄ່າໂຄສະນາ`,
        reason: `ຄ່າ boost ${money(a.boost.spendLak)} · ຍອດຈອງ ${money(a.reservedValue)}`,
        impact: "ຮອບໜ້າລອງເພີ່ມງົບ 20–30% ດ້ວຍກຸ່ມເປົ້າໝາຍເກົ່າ ແລ້ວທຽບຜົນ",
        confidence: confidenceFrom(a.boost.spendLak, MIN_BOOST_SPEND_LAK),
        sample: `ຄ່າ boost ${money(a.boost.spendLak)}`,
      });
    }
  }

  const order: Advice["kind"][] = ["cut", "scale", "shift", "watch", "wait", "info"];
  return out.sort((x, y) => order.indexOf(x.kind) - order.indexOf(y.kind));
}
