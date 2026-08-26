import { prisma } from "./prisma";
import { parseDate, type DateRange } from "./date";
import { aggregate, type Derived, type Totals } from "./metrics";
import { SEGMENT_DEFS, segmentLabel, type SegmentDef } from "./segments";
import { safeDiv } from "./format";
import type { SegmentKind } from "@/generated/prisma/enums";

/**
 * ວິເຄາະຜົນແຍກກຸ່ມ — ຫາວ່າ "ກຸ່ມໃດຄຸ້ມ ກຸ່ມໃດຖິ້ມເງິນ".
 *
 * ຕົວຊີ້ວັດຫຼັກຄື **ຄ່າຕໍ່ 1 ຄົນທັກ** ເພາະຕະຫຼາດລາວປິດການຂາຍຜ່ານແຊັດ.
 *
 * ⚠️ ບວກຂ້າມມິຕິບໍ່ໄດ້ (ອາຍຸ + ແຂວງ = 2 ເທົ່າ) — ເບິ່ງ `src/lib/segments.ts`
 */

export type SegmentRow = Derived & {
  segKey: string;
  label: string;
  /** ສ່ວນແບ່ງຄ່າໂຄສະນາຂອງກຸ່ມນີ້ໃນມິຕິດຽວກັນ (0–1) */
  spendShare: number;
  /** ສ່ວນແບ່ງຄົນທັກ (0–1) */
  messageShare: number;
  /** ຄ່າຕໍ່ຄົນທັກທຽບກັບສະເລ່ຍ — 1.0 = ເທົ່າສະເລ່ຍ, 2.0 = ແພງ 2 ເທົ່າ */
  costIndex: number;
};

export type SegmentReport = {
  def: SegmentDef;
  total: Derived;
  rows: SegmentRow[];
};

/**
 * ເກນຄວາມໜ້າເຊື່ອຖື — **ແຍກກັນລະຫວ່າງ "ຄວນເພີ່ມ" ກັບ "ຄວນຕັດ"**
 * ເພາະຫຼັກຖານຄົນລະແບບ:
 *
 * - ຈະບອກວ່າກຸ່ມໃດ **ດີ** ຕ້ອງມີຄົນທັກພຽງພໍ (ຄົນທັກນ້ອຍ = ຄວາມບັງເອີນ)
 * - ຈະບອກວ່າກຸ່ມໃດ **ບໍ່ດີ** ຕ້ອງມີເງິນທີ່ເສຍໄປພຽງພໍ — ການທີ່ຄົນທັກນ້ອຍ
 *   ທັງທີ່ໃຊ້ເງິນຫຼາຍ *ຄືຫຼັກຖານເອງ* ຈຶ່ງໃຊ້ເກນຄົນທັກບໍ່ໄດ້
 */
export const MIN_MESSAGES_ABS = 10;
export const MIN_MESSAGE_SHARE = 0.05;
export const MIN_SPEND_SHARE = 0.05;
export const MIN_SPEND_LAK = 20_000;

function toTotals(row: {
  spendLak: number;
  impressions: number;
  reach: number;
  clicks: number;
  linkClicks: number;
  messages: number;
  leadsCount: number;
  purchases: number;
  revenue: number;
}): Partial<Totals> {
  return { ...row, videoViews: 0 };
}

/** ອ່ານ ແລະ ລວມຜົນແຍກກຸ່ມ 1 ມິຕິ ໃນຊ່ວງວັນທີ່ເລືອກ */
export async function buildSegmentReport(
  kind: SegmentKind,
  range: DateRange,
  campaignId?: string,
): Promise<SegmentReport> {
  const def = SEGMENT_DEFS.find((d) => d.kind === kind)!;

  const rows = await prisma.segmentInsight.findMany({
    where: {
      kind,
      date: { gte: parseDate(range.from), lte: parseDate(range.to) },
      ...(campaignId ? { campaignId } : {}),
    },
  });

  const grouped = new Map<string, Partial<Totals>[]>();
  for (const r of rows) {
    const list = grouped.get(r.segKey) ?? [];
    list.push(toTotals(r));
    grouped.set(r.segKey, list);
  }

  const total = aggregate(rows.map(toTotals));

  const out: SegmentRow[] = [];
  for (const [segKey, list] of grouped) {
    const d = aggregate(list);
    out.push({
      ...d,
      segKey,
      label: segmentLabel(kind, segKey),
      spendShare: safeDiv(d.spendLak, total.spendLak),
      messageShare: safeDiv(d.messages, total.messages),
      costIndex:
        total.costPerMessage > 0
          ? safeDiv(d.costPerMessage, total.costPerMessage)
          : 0,
    });
  }

  // ຄຸ້ມສຸດຂຶ້ນກ່ອນ — ກຸ່ມທີ່ບໍ່ມີຄົນທັກເລີຍໄປທ້າຍສຸດ (ຮຽງຕາມເງິນທີ່ເສຍ)
  out.sort((a, b) => {
    if (a.messages === 0 && b.messages === 0) return b.spendLak - a.spendLak;
    if (a.messages === 0) return 1;
    if (b.messages === 0) return -1;
    return a.costPerMessage - b.costPerMessage;
  });

  return { def, total, rows: out };
}

export async function buildAllSegmentReports(
  range: DateRange,
  campaignId?: string,
): Promise<SegmentReport[]> {
  return Promise.all(
    SEGMENT_DEFS.map((d) => buildSegmentReport(d.kind, range, campaignId)),
  );
}

/**
 * ກຸ່ມທີ່ຫຼັກຖານພຽງພໍຈະບອກວ່າ **ດີ** — ຕ້ອງມີຄົນທັກຫຼາຍພໍ
 * ທັງແບບຈຳນວນຈິງ ແລະ ແບບສັດສ່ວນຂອງທັງໝົດ
 */
export function trustedGood(report: SegmentReport): SegmentRow[] {
  const floor = Math.max(
    MIN_MESSAGES_ABS,
    report.total.messages * MIN_MESSAGE_SHARE,
  );
  return report.rows.filter((r) => r.messages >= floor);
}

/**
 * ກຸ່ມທີ່ຫຼັກຖານພຽງພໍຈະບອກວ່າ **ບໍ່ດີ** — ຕ້ອງມີເງິນທີ່ເສຍໄປຫຼາຍພໍ
 * (ຄົນທັກນ້ອຍທັງທີ່ໃຊ້ເງິນຫຼາຍ ຄືຕົວຫຼັກຖານເອງ)
 */
export function trustedBad(report: SegmentReport): SegmentRow[] {
  return report.rows.filter(
    (r) => r.spendLak >= MIN_SPEND_LAK && r.spendShare >= MIN_SPEND_SHARE,
  );
}

/** ມີຂໍ້ມູນພໍໃຫ້ວິເຄາະບໍ່ */
export function hasData(reports: SegmentReport[]): boolean {
  return reports.some((r) => r.rows.length > 0);
}
