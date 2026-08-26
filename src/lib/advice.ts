import { prisma } from "./prisma";
import { parseDate, type DateRange } from "./date";
import { aggregate } from "./metrics";
import { totalsScope } from "./scope";
import { formatInt, safeDiv } from "./format";
import { hourBand } from "./segments";
import { type MoneyFn } from "./money";
import { loadMoney } from "./money-server";
import {
  MIN_MESSAGES_ABS,
  MIN_SPEND_LAK,
  buildAllSegmentReports,
  trustedBad,
  trustedGood,
  type SegmentReport,
} from "./analysis";
import { SegmentKind } from "@/generated/prisma/enums";
import { confidenceFrom, suggestBudgetStep, type Advice } from "./advice-types";
import {
  adviseCreativeFatigue,
  adviseEconomicsSummary,
  adviseUnitEconomics,
  adviseWaiting,
  orderEconomics,
} from "./advice-rules";

/**
 * ເຄື່ອງອອກຄຳແນະນຳ — ປ່ຽນຕົວເລກໃຫ້ເປັນ "ຄວນເຮັດຫຍັງຕໍ່".
 *
 * ຫຼັກການ 3 ຂໍ້ທີ່ຫ້າມລະເມີດ:
 *
 * 1. **ທຸກຄຳແນະນຳຕ້ອງມີເຫດຜົນເປັນຕົວເລກ** ໃຫ້ຄົນກວດຄືນໄດ້
 * 2. **ຂໍ້ມູນບາງໆບອກຫຍັງບໍ່ໄດ້** — ເກນຢູ່ `analysis.ts` ແລະ ແຍກກັນ
 *    ລະຫວ່າງການບອກວ່າ "ດີ" (ຕ້ອງມີຄົນທັກພຽງພໍ) ກັບ "ບໍ່ດີ" (ຕ້ອງມີເງິນທີ່ເສຍພຽງພໍ)
 * 3. **ຄຳແນະນຳຜິດຮ້າຍກວ່າບໍ່ມີຄຳແນະນຳ** — ສົງໄສໃຫ້ງຽບໄວ້
 */

export {
  adviceTone,
  CONFIDENCE_LABEL,
  type Advice,
  type AdviceKind,
  type Confidence,
} from "./advice-types";

/** ຄ່າຕໍ່ຄົນທັກຕ້ອງຕ່າງກັນເທົ່ານີ້ຂຶ້ນໄປ ຈຶ່ງຄຸ້ມທີ່ຈະລົງມື */
const MEANINGFUL_GAP = 1.4;

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** ຄຳແນະນຳຈາກມິຕິໜຶ່ງ — ຫາທັງກຸ່ມທີ່ຄວນຕັດ ແລະ ກຸ່ມທີ່ຄວນເພີ່ມ */
function adviseSegment(report: SegmentReport, money: MoneyFn): Advice[] {
  if (report.total.messages < MIN_MESSAGES_ABS * 2) return [];
  const out: Advice[] = [];
  const kind = report.def.kind;
  const avg = report.total.costPerMessage;

  // ---- ຄວນຕັດ: ໃຊ້ເງິນຫຼາຍພໍ ແຕ່ໄດ້ຄົນທັກແພງກວ່າສະເລ່ຍຊັດເຈນ
  const bad = trustedBad(report)
    .filter((r) => r.messages === 0 || r.costIndex > MEANINGFUL_GAP)
    .sort((a, b) => b.spendLak - a.spendLak);

  for (const r of bad.slice(0, 2)) {
    // ເງິນທີ່ຈະປະຢັດໄດ້ = ຄ່າທີ່ຈ່າຍຈິງ ລົບ ຄ່າທີ່ຄວນຈະຈ່າຍຖ້າຄຸ້ມເທົ່າສະເລ່ຍ
    const wasted = Math.max(0, r.spendLak - r.messages * avg);
    out.push({
      id: `cut:${kind}:${r.segKey}`,
      kind: "cut",
      title: `ຕັດ ${r.label} ອອກ`,
      reason:
        r.messages === 0
          ? `ໃຊ້ໄປ ${money(r.spendLak)} (${pct(r.spendShare)} ຂອງງົບ) ແຕ່ບໍ່ມີຄົນທັກເລີຍ`
          : `ຄ່າຕໍ່ຄົນທັກ ${money(r.costPerMessage)} ແພງກວ່າສະເລ່ຍ ` +
            `${r.costIndex.toFixed(1)} ເທົ່າ ແຕ່ກິນງົບ ${pct(r.spendShare)} ` +
            `(${money(r.spendLak)} ໄດ້ ${formatInt(r.messages)} ຄົນທັກ)`,
      impact: wasted > 0 ? `ຕັດແລ້ວປະຢັດໄດ້ປະມານ ${money(wasted)}` : undefined,
      confidence: confidenceFrom(r.spendLak, MIN_SPEND_LAK),
      sample: `${formatInt(r.messages)} ຄົນທັກ · ${money(r.spendLak)}`,
      href: `/analysis?kind=${kind}`,
    });
  }

  // ---- ຄວນເພີ່ມ: ຄົນທັກຫຼາຍພໍໃຫ້ເຊື່ອ ແລະ ຄຸ້ມກວ່າສະເລ່ຍຊັດເຈນ
  const good = trustedGood(report)
    .filter((r) => r.costIndex > 0 && r.costIndex < 1 / MEANINGFUL_GAP)
    .sort((a, b) => a.costPerMessage - b.costPerMessage);

  for (const r of good.slice(0, 2)) {
    out.push({
      id: `scale:${kind}:${r.segKey}`,
      kind: "scale",
      title: `ເພີ່ມງົບໃສ່ ${r.label}`,
      reason:
        `ຄ່າຕໍ່ຄົນທັກ ${money(r.costPerMessage)} ຖືກກວ່າສະເລ່ຍ ` +
        `${money(avg)} ຢູ່ ${Math.round((1 - r.costIndex) * 100)}% ` +
        `(${formatInt(r.messages)} ຄົນທັກ · ${pct(r.messageShare)} ຂອງທັງໝົດ)`,
      impact:
        r.spendShare < r.messageShare
          ? `ໄດ້ຄົນທັກ ${pct(r.messageShare)} ແຕ່ໃຊ້ງົບແຕ່ ${pct(r.spendShare)} — ` +
            `ລອງເພີ່ມງົບເທື່ອລະ ${suggestBudgetStep(r.costIndex)} ແລ້ວເບິ່ງ 3 ວັນ`
          : `ລອງເພີ່ມງົບເທື່ອລະ ${suggestBudgetStep(r.costIndex)} ແລ້ວເບິ່ງ 3 ວັນ`,
      confidence: confidenceFrom(r.messages, MIN_MESSAGES_ABS),
      sample: `${formatInt(r.messages)} ຄົນທັກ · ${money(r.spendLak)}`,
      href: `/analysis?kind=${kind}`,
    });
  }

  return out;
}

/** ຄຳແນະນຳເລື່ອງເວລາ — ຈັດເປັນຊ່ວງ ເພາະຊົ່ວໂມງດຽວເອົາໄປໃຊ້ຍາກ */
function adviseHours(report: SegmentReport, money: MoneyFn): Advice[] {
  if (report.total.messages < MIN_MESSAGES_ABS * 3) return [];

  const bands = new Map<string, { spendLak: number; messages: number }>();
  for (const r of report.rows) {
    const band = hourBand(Number(r.segKey));
    const cur = bands.get(band) ?? { spendLak: 0, messages: 0 };
    cur.spendLak += r.spendLak;
    cur.messages += r.messages;
    bands.set(band, cur);
  }

  // ຊ່ວງເວລາຕ້ອງມີຄົນທັກຢ່າງໜ້ອຍ 15% ຂອງທັງໝົດ ຈຶ່ງເອົາມາປຽບທຽບ
  const floor = Math.max(MIN_MESSAGES_ABS, report.total.messages * 0.15);
  const ranked = [...bands.entries()]
    .map(([band, v]) => ({ band, ...v, cost: safeDiv(v.spendLak, v.messages) }))
    .filter((b) => b.messages >= floor && b.cost > 0)
    .sort((a, b) => a.cost - b.cost);

  if (ranked.length < 2) return [];
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  const gap = safeDiv(worst.cost, best.cost);
  if (gap < MEANINGFUL_GAP) return [];

  return [
    {
      id: `shift:hour:${best.band}`,
      kind: "shift",
      title: `ຍ້າຍງົບໄປຊ່ວງ ${best.band}`,
      reason:
        `${best.band} ຄ່າຕໍ່ຄົນທັກ ${money(best.cost)} (${formatInt(best.messages)} ຄົນທັກ) · ` +
        `${worst.band} ${money(worst.cost)} (${formatInt(worst.messages)} ຄົນທັກ) — ຕ່າງກັນ ${gap.toFixed(1)} ເທົ່າ`,
      impact:
        "ຕັ້ງເວລາສະແດງໂຄສະນາໄດ້ໃນຊຸດໂຄສະນາ ຖ້າໃຊ້ງົບລວມ (lifetime budget)",
      confidence: confidenceFrom(best.messages + worst.messages, MIN_MESSAGES_ABS * 3),
      sample: `${formatInt(best.messages + worst.messages)} ຄົນທັກ ໃນ 2 ຊ່ວງເວລາ`,
      href: "/analysis?kind=HOUR",
    },
  ];
}

/** ຄຳແນະນຳລະດັບແຄມເປນ */
async function adviseCampaigns(
  range: DateRange,
  money: MoneyFn,
): Promise<Advice[]> {
  const rows = await prisma.insight.findMany({
    where: {
      ...totalsScope,
      date: { gte: parseDate(range.from), lte: parseDate(range.to) },
    },
    include: { campaign: { select: { id: true, name: true } } },
  });
  if (rows.length === 0) return [];

  const byCampaign = new Map<string, { name: string; rows: typeof rows }>();
  for (const r of rows) {
    if (!r.campaign) continue;
    const cur = byCampaign.get(r.campaign.id) ?? {
      name: r.campaign.name,
      rows: [],
    };
    cur.rows.push(r);
    byCampaign.set(r.campaign.id, cur);
  }
  if (byCampaign.size < 2) return [];

  const overall = aggregate(rows);
  const out: Advice[] = [];

  for (const [id, { name, rows: list }] of byCampaign) {
    const d = aggregate(list);
    if (d.spendLak <= 0) continue;

    // ໃຊ້ເງິນຫຼາຍ ແຕ່ບໍ່ມີຄົນທັກ — ບອກໄດ້ໂດຍບໍ່ຕ້ອງລໍໃຫ້ມີຄົນທັກ
    if (d.messages === 0 && d.spendLak >= overall.spendLak * 0.15) {
      out.push({
        id: `cut:campaign:${id}`,
        kind: "cut",
        title: `ແຄມເປນ "${name}" ບໍ່ມີຄົນທັກເລີຍ`,
        reason: `ໃຊ້ໄປ ${money(d.spendLak)} ໃນຊ່ວງນີ້ ແຕ່ບໍ່ໄດ້ຄົນທັກ`,
        confidence: confidenceFrom(d.spendLak, overall.spendLak * 0.15),
        sample: `${money(d.spendLak)} ຄ່າໂຄສະນາ · 0 ຄົນທັກ`,
        href: `/campaigns/${id}`,
      });
      continue;
    }
    if (d.messages < MIN_MESSAGES_ABS) continue;

    const index = safeDiv(d.costPerMessage, overall.costPerMessage);
    if (index > MEANINGFUL_GAP) {
      out.push({
        id: `cut:campaign:${id}`,
        kind: "cut",
        title: `ທົບທວນແຄມເປນ "${name}"`,
        reason:
          `ຄ່າຕໍ່ຄົນທັກ ${money(d.costPerMessage)} ແພງກວ່າແຄມເປນອື່ນ ` +
          `${index.toFixed(1)} ເທົ່າ (${formatInt(d.messages)} ຄົນທັກ · ${money(d.spendLak)})`,
        confidence: confidenceFrom(d.messages, MIN_MESSAGES_ABS),
        sample: `${formatInt(d.messages)} ຄົນທັກ · ${money(d.spendLak)}`,
        href: `/campaigns/${id}`,
      });
    } else if (index > 0 && index < 1 / MEANINGFUL_GAP) {
      out.push({
        id: `scale:campaign:${id}`,
        kind: "scale",
        title: `ຂະຫຍາຍແຄມເປນ "${name}"`,
        reason:
          `ຄ່າຕໍ່ຄົນທັກ ${money(d.costPerMessage)} ຖືກກວ່າແຄມເປນອື່ນ ` +
          `${(1 / index).toFixed(1)} ເທົ່າ (${formatInt(d.messages)} ຄົນທັກ)`,
        impact: `ລອງເພີ່ມງົບເທື່ອລະ ${suggestBudgetStep(index)} ແລ້ວເບິ່ງ 3 ວັນ`,
        confidence: confidenceFrom(d.messages, MIN_MESSAGES_ABS),
        sample: `${formatInt(d.messages)} ຄົນທັກ · ${money(d.spendLak)}`,
        href: `/campaigns/${id}`,
      });
    }
  }
  return out;
}

/** ເຕືອນເມື່ອຄ່າຕໍ່ຄົນທັກແພງຂຶ້ນຕໍ່ເນື່ອງ — ສັນຍານໂຄສະນາເລີ່ມລ້າ */
async function adviseTrend(
  range: DateRange,
  money: MoneyFn,
): Promise<Advice[]> {
  const rows = await prisma.insight.findMany({
    where: {
      ...totalsScope,
      date: { gte: parseDate(range.from), lte: parseDate(range.to) },
    },
    orderBy: { date: "asc" },
  });
  if (rows.length < 6) return [];

  const half = Math.floor(rows.length / 2);
  const older = aggregate(rows.slice(0, half));
  const newer = aggregate(rows.slice(half));
  if (older.messages < MIN_MESSAGES_ABS || newer.messages < MIN_MESSAGES_ABS) {
    return [];
  }

  const change = safeDiv(newer.costPerMessage, older.costPerMessage);
  if (change < 1.3) return [];

  return [
    {
      id: "watch:trend",
      kind: "watch",
      title: "ຄ່າຕໍ່ຄົນທັກກຳລັງແພງຂຶ້ນ",
      reason:
        `ເຄິ່ງທຳອິດຂອງຊ່ວງ ${money(older.costPerMessage)} → ` +
        `ເຄິ່ງຫຼັງ ${money(newer.costPerMessage)} (ຂຶ້ນ ${Math.round((change - 1) * 100)}%)`,
      impact: "ມັກເກີດເມື່ອກຸ່ມເປົ້າໝາຍເລີ່ມເບື່ອຮູບ — ລອງປ່ຽນຮູບ/ຂໍ້ຄວາມໃໝ່",
      confidence: confidenceFrom(older.messages + newer.messages, MIN_MESSAGES_ABS * 2),
      sample: `${formatInt(older.messages + newer.messages)} ຄົນທັກ · ${rows.length} ວັນ`,
      href: "/campaigns",
    },
  ];
}

/** ຈຸດຄຸ້ມທຶນ — ຕ້ອງຂາຍເທົ່າໃດຈຶ່ງບໍ່ຂາດທຶນ */
async function adviseBreakEven(
  range: DateRange,
  money: MoneyFn,
): Promise<Advice[]> {
  const [rows, products] = await Promise.all([
    prisma.insight.findMany({
      where: {
        ...totalsScope,
        date: { gte: parseDate(range.from), lte: parseDate(range.to) },
      },
    }),
    prisma.product.findMany({ where: { active: true } }),
  ]);

  const t = aggregate(rows);
  if (t.spendLak <= 0) return [];

  if (products.length === 0) {
    return [
      {
        id: "info:no-product",
        kind: "info",
        title: "ຍັງບອກບໍ່ໄດ້ວ່າກຳໄລ ຫຼື ຂາດທຶນ",
        reason:
          `ຊ່ວງນີ້ໃຊ້ຄ່າໂຄສະນາ ${money(t.spendLak)} ໄດ້ ${formatInt(t.messages)} ຄົນທັກ ` +
          `ແຕ່ລະບົບຍັງບໍ່ຮູ້ລາຄາຂາຍ ແລະ ຕົ້ນທຶນສິນຄ້າ`,
        impact: "ໃສ່ສິນຄ້າ 1 ລາຍການ ແລ້ວລະບົບຈະຄິດຈຸດຄຸ້ມທຶນໃຫ້ອັດຕະໂນມັດ",
        confidence: "low",
        sample: `${formatInt(t.messages)} ຄົນທັກ · 0 ສິນຄ້າ`,
        href: "/products",
      },
    ];
  }

  const margins = products.map((p) => p.price - p.cost).filter((m) => m > 0);
  if (margins.length === 0) return [];
  const avgMargin = margins.reduce((a, b) => a + b, 0) / margins.length;

  const days = Math.max(1, new Set(rows.map((r) => r.date.getTime())).size);
  const ordersNeeded = Math.ceil(safeDiv(t.spendLak, avgMargin));
  const perDay = Math.ceil(safeDiv(ordersNeeded, days));
  const closeRate = safeDiv(ordersNeeded, t.messages);

  return [
    {
      id: "info:break-even",
      kind: "info",
      title: `ຕ້ອງຂາຍ ${formatInt(perDay)} ອໍເດີ/ວັນ ຈຶ່ງບໍ່ຂາດທຶນ`,
      reason:
        `ຄ່າໂຄສະນາ ${money(t.spendLak)} ໃນ ${days} ວັນ · ` +
        `ກຳໄລຂັ້ນຕົ້ນສະເລ່ຍ ${money(avgMargin)}/ອໍເດີ → ຕ້ອງການ ${formatInt(ordersNeeded)} ອໍເດີ`,
      impact:
        t.messages > 0
          ? `ຈາກ ${formatInt(t.messages)} ຄົນທັກ ຕ້ອງປິດການຂາຍໃຫ້ໄດ້ ${pct(closeRate)}`
          : undefined,
      confidence: confidenceFrom(days, 7),
      sample: `${days} ວັນ · ${formatInt(products.length)} ສິນຄ້າ`,
      href: "/orders",
    },
  ];
}

/** ຄຳແນະນຳທັງໝົດ ຈັດລຳດັບຄວາມສຳຄັນແລ້ວ */
export async function buildAdvice(range: DateRange): Promise<Advice[]> {
  const [{ money }, reports] = await Promise.all([
    loadMoney(),
    buildAllSegmentReports(range),
  ]);

  const segmentAdvice = reports.flatMap((r) =>
    r.def.kind === SegmentKind.HOUR
      ? adviseHours(r, money)
      : adviseSegment(r, money),
  );

  const econ = await orderEconomics(range);

  const [campaigns, trend, breakEven, fatigue, unit, waiting] =
    await Promise.all([
      adviseCampaigns(range, money),
      adviseTrend(range, money),
      econ ? Promise.resolve([]) : adviseBreakEven(range, money),
      adviseCreativeFatigue(range, money),
      econ ? adviseUnitEconomics(range, money, econ) : Promise.resolve([]),
      adviseWaiting(range, money, econ),
    ]);

  const all = [
    ...(econ ? adviseEconomicsSummary(econ, money) : []),
    ...unit,
    ...campaigns,
    ...segmentAdvice,
    ...fatigue,
    ...trend,
    ...breakEven,
    ...waiting,
  ];

  const order: Advice["kind"][] = [
    "cut",
    "scale",
    "shift",
    "watch",
    "wait",
    "info",
  ];
  const rank = (a: Advice) =>
    order.indexOf(a.kind) * 10 +
    ({ high: 0, medium: 1, low: 2 } as const)[a.confidence];
  return all.sort((a, b) => rank(a) - rank(b));
}

/** ໃຊ້ໃນໜ້າຫຼັກ — ເອົາສະເພາະທີ່ຕ້ອງລົງມື */
export function actionable(advice: Advice[]): Advice[] {
  return advice.filter((a) => a.kind !== "info" && a.kind !== "wait");
}

/** ສິ່ງທີ່ຍັງຕັດສິນບໍ່ໄດ້ ແລະ ຂາດຫຍັງ — ສະແດງແຍກຈາກຄຳແນະນຳ */
export function waiting(advice: Advice[]): Advice[] {
  return advice.filter((a) => a.kind === "wait");
}

/** ສະຫຼຸບຕົວເລກຂອງຮອບ (ກຳໄລ, ROAS, CAC) — ບໍ່ແມ່ນສິ່ງທີ່ຕ້ອງລົງມື */
export function summary(advice: Advice[]): Advice[] {
  return advice.filter((a) => a.kind === "info");
}
