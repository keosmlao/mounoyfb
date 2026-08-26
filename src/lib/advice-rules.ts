import { prisma } from "./prisma";
import { parseDate, toDateInput, type DateRange } from "./date";
import { aggregate, derive, sumTotals, type Totals } from "./metrics";
import { totalsScope } from "./scope";
import { formatInt, formatPercent, safeDiv } from "./format";
import type { MoneyFn } from "./money";
import {
  aggregateOrders,
  sumOrderTotals,
  type OrderFinancialRow,
} from "./orders";
import {
  confidenceFrom,
  type Advice,
  type Confidence,
} from "./advice-types";

/**
 * ກົດແນະນຳທີ່ຕ້ອງໃຊ້ຂໍ້ມູນນອກເໜືອຈາກ SegmentInsight —
 * ຄວາມລ້າຂອງຮູບໂຄສະນາ (ລະດັບຊິ້ນ) ແລະ ເສດຖະສາດຂອງອໍເດີ (CAC / break-even).
 *
 * ແຍກອອກຈາກ `advice.ts` ເພາະດຶງຂໍ້ມູນຄົນລະຊຸດກັນ ແລະ ຈະຍາວຂຶ້ນເລື້ອຍໆ.
 */

// ------------------------------------------------------------ ຄວາມລ້າຂອງຮູບ

/** ຕ້ອງມີຢ່າງໜ້ອຍເທົ່ານີ້ຈຶ່ງເຊື່ອການປຽບທຽບ 2 ເຄິ່ງ */
const FATIGUE_MIN_DAYS = 6;
const FATIGUE_MIN_IMPRESSIONS = 500;

/** ເກນສັນຍານ — ຕ້ອງເຂົ້າ 2 ໃນ 3 ຈຶ່ງເຕືອນ ເພາະອັນດຽວອາດເປັນຄວາມບັງເອີນ */
const CTR_DROP = 0.2;
const CPM_RISE = 0.2;
const FREQUENCY_HIGH = 2.5;

/**
 * ຮູບໂຄສະນາທີ່ຄົນເລີ່ມເບື່ອ — ອາການຄື **ຄົນເຫັນຊ້ຳຫຼາຍຂຶ້ນ, ຄລິກໜ້ອຍລົງ,
 * ຄ່າຕໍ່ການເຫັນແພງຂຶ້ນ** ພ້ອມກັນ. ອັນດຽວບໍ່ພໍບອກ ຕ້ອງມີຢ່າງໜ້ອຍ 2 ໃນ 3.
 */
export async function adviseCreativeFatigue(
  range: DateRange,
  money: MoneyFn,
): Promise<Advice[]> {
  const rows = await prisma.insight.findMany({
    where: {
      level: "AD",
      date: { gte: parseDate(range.from), lte: parseDate(range.to) },
    },
    orderBy: { date: "asc" },
    include: {
      ad: {
        select: {
          id: true,
          name: true,
          adSet: { select: { campaign: { select: { id: true, name: true } } } },
        },
      },
    },
  });
  if (rows.length === 0) return [];

  const byAd = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!r.ad) continue;
    const list = byAd.get(r.ad.id) ?? [];
    list.push(r);
    byAd.set(r.ad.id, list);
  }

  const out: Advice[] = [];

  for (const [adId, list] of byAd) {
    const days = new Set(list.map((r) => toDateInput(r.date)));
    if (days.size < FATIGUE_MIN_DAYS) continue;

    const half = Math.floor(list.length / 2);
    const first = derive(sumTotals(list.slice(0, half) as Partial<Totals>[]));
    const second = derive(sumTotals(list.slice(half) as Partial<Totals>[]));
    if (
      first.impressions < FATIGUE_MIN_IMPRESSIONS ||
      second.impressions < FATIGUE_MIN_IMPRESSIONS
    ) {
      continue;
    }

    const ctrDrop = first.ctr > 0 ? 1 - safeDiv(second.ctr, first.ctr) : 0;
    const cpmRise = first.cpm > 0 ? safeDiv(second.cpm, first.cpm) - 1 : 0;
    const freq = second.frequency;

    const signals: string[] = [];
    if (ctrDrop >= CTR_DROP) {
      signals.push(
        `CTR ຫຼຸດ ${formatPercent(ctrDrop)} (${formatPercent(first.ctr)} → ${formatPercent(second.ctr)})`,
      );
    }
    if (cpmRise >= CPM_RISE) {
      signals.push(
        `CPM ຂຶ້ນ ${formatPercent(cpmRise)} (${money(first.cpm)} → ${money(second.cpm)})`,
      );
    }
    if (freq >= FREQUENCY_HIGH) {
      signals.push(`ຄົນເຫັນຊ້ຳສະເລ່ຍ ${freq.toFixed(1)} ເທື່ອ`);
    }
    if (signals.length < 2) continue;

    const ad = list[0].ad!;
    const campaign = ad.adSet?.campaign;
    out.push({
      id: `watch:fatigue:${adId}`,
      kind: "watch",
      title: `ຮູບໂຄສະນາ "${ad.name}" ເລີ່ມລ້າ`,
      reason: signals.join(" · "),
      impact:
        "ຄົນກຸ່ມເປົ້າໝາຍເຫັນຊ້ຳຈົນເບື່ອ — ປ່ຽນຮູບ/ວິດີໂອ ຫຼື ຂະຫຍາຍກຸ່ມເປົ້າໝາຍ",
      confidence: confidenceFrom(second.impressions, FATIGUE_MIN_IMPRESSIONS),
      sample: `${formatInt(first.impressions + second.impressions)} ຄັ້ງທີ່ເຫັນ · ${days.size} ວັນ`,
      href: campaign ? `/campaigns/${campaign.id}` : undefined,
    });
  }

  return out;
}

// ------------------------------------------------------- ເສດຖະສາດຂອງອໍເດີ

/** ເປີເຊັນແບບຈຳນວນເຕັມ — ຕົວເລກລະດັບນີ້ບອກທົດນິຍົມໄປກໍ່ບໍ່ຊ່ວຍຕັດສິນໃຈ */
function whole(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** ຕ້ອງມີອໍເດີທີ່ສົ່ງສຳເລັດເທົ່ານີ້ຈຶ່ງຄິດ CAC ໄດ້ໜ້າເຊື່ອຖື */
const MIN_DELIVERED = 5;
/** ຄົນທັກຂັ້ນຕ່ຳກ່ອນຈະຕັດສິນເລື່ອງອັດຕາປິດການຂາຍ */
const MIN_MESSAGES_FOR_CLOSE_RATE = 20;

export type OrderEconomicsSummary = {
  delivered: number;
  returned: number;
  /** ອັດຕາສົ່ງສຳເລັດ = ສຳເລັດ ÷ (ສຳເລັດ + ຕີກັບ) */
  deliveryRate: number;
  netRevenue: number;
  /** ກຳໄລສະເລ່ຍຕໍ່ອໍເດີ ກ່ອນຫັກຄ່າໂຄສະນາ = ເພດານ CAC */
  marginPerOrder: number;
  /** ROAS ຂັ້ນຕ່ຳທີ່ຕ້ອງໄດ້ຈຶ່ງບໍ່ຂາດທຶນ */
  breakEvenRoas: number;
  adSpend: number;
  actualRoas: number;
  contributionProfit: number;
};

/**
 * ຄິດເພດານ CAC ແລະ break-even ROAS ຈາກອໍເດີຈິງ.
 *
 * - **ເພດານ CAC** = ກຳໄລສະເລ່ຍຕໍ່ 1 ອໍເດີ (ຫຼັງຫັກຕົ້ນທຶນສິນຄ້າ+ຄ່າສົ່ງ)
 *   ຈ່າຍຄ່າໂຄສະນາເກີນນີ້ຕໍ່ 1 ອໍເດີ = ຂາດທຶນ
 * - **break-even ROAS** = 1 ÷ ອັດຕາກຳໄລຂັ້ນຕົ້ນ
 */
export async function orderEconomics(
  range: DateRange,
): Promise<OrderEconomicsSummary | null> {
  const [orders, adRows] = await Promise.all([
    prisma.order.findMany({
      where: { date: { gte: parseDate(range.from), lte: parseDate(range.to) } },
      select: {
        status: true,
        saleAmount: true,
        productCost: true,
        shippingCost: true,
        otherCost: true,
        refundAmount: true,
      },
    }),
    prisma.insight.findMany({
      where: {
        ...totalsScope,
        date: { gte: parseDate(range.from), lte: parseDate(range.to) },
      },
    }),
  ]);

  const adSpend = aggregate(adRows).spendLak;
  const econ = aggregateOrders(orders as OrderFinancialRow[], adSpend);
  if (econ.delivered < MIN_DELIVERED) return null;

  const marginPerOrder = safeDiv(econ.orderMargin, econ.delivered);
  const marginRate = safeDiv(econ.orderMargin, econ.netRevenue);

  return {
    delivered: econ.delivered,
    returned: econ.returned,
    deliveryRate: 1 - econ.returnRate,
    netRevenue: econ.netRevenue,
    marginPerOrder,
    breakEvenRoas: marginRate > 0 ? 1 / marginRate : 0,
    adSpend,
    actualRoas: econ.actualRoas,
    contributionProfit: econ.contributionProfit,
  };
}

/** ແຄມເປນທີ່ຈ່າຍຄ່າໂຄສະນາຕໍ່ອໍເດີເກີນເພດານ + ອັນທີ່ຄົນທັກຫຼາຍແຕ່ປິດບໍ່ໄດ້ */
export async function adviseUnitEconomics(
  range: DateRange,
  money: MoneyFn,
  econ: OrderEconomicsSummary,
): Promise<Advice[]> {
  const dateWhere = {
    gte: parseDate(range.from),
    lte: parseDate(range.to),
  };

  const [adRows, orderRows] = await Promise.all([
    prisma.insight.findMany({
      where: { ...totalsScope, date: dateWhere },
      include: { campaign: { select: { id: true, name: true } } },
    }),
    prisma.order.findMany({
      where: { date: dateWhere, campaignId: { not: null } },
      select: {
        campaignId: true,
        status: true,
        saleAmount: true,
        productCost: true,
        shippingCost: true,
        otherCost: true,
        refundAmount: true,
      },
    }),
  ]);

  const spendByCampaign = new Map<string, { name: string; rows: Totals[] }>();
  for (const r of adRows) {
    if (!r.campaign) continue;
    const cur = spendByCampaign.get(r.campaign.id) ?? {
      name: r.campaign.name,
      rows: [],
    };
    cur.rows.push(r as unknown as Totals);
    spendByCampaign.set(r.campaign.id, cur);
  }

  const ordersByCampaign = new Map<string, OrderFinancialRow[]>();
  for (const o of orderRows) {
    const key = o.campaignId as string;
    const list = ordersByCampaign.get(key) ?? [];
    list.push(o as OrderFinancialRow);
    ordersByCampaign.set(key, list);
  }

  // ອັດຕາປິດການຂາຍລວມ — ໃຊ້ເປັນເສັ້ນຖານປຽບທຽບ
  const allMessages = aggregate(adRows).messages;
  const allDelivered = sumOrderTotals(
    orderRows as OrderFinancialRow[],
  ).delivered;
  const baseCloseRate = safeDiv(allDelivered, allMessages);

  const out: Advice[] = [];

  for (const [id, { name, rows }] of spendByCampaign) {
    const t = derive(sumTotals(rows));
    if (t.spendLak <= 0) continue;

    const orders = ordersByCampaign.get(id) ?? [];
    const totals = sumOrderTotals(orders);

    // ---- ຈ່າຍເກີນເພດານ CAC
    if (totals.delivered > 0) {
      const cac = safeDiv(t.spendLak, totals.delivered);
      if (cac > econ.marginPerOrder) {
        out.push({
          id: `cut:cac:${id}`,
          kind: "cut",
          title: `"${name}" ຈ່າຍເກີນເພດານຕໍ່ອໍເດີ`,
          reason:
            `ຄ່າໂຄສະນາຕໍ່ 1 ອໍເດີ ${money(cac)} ແຕ່ກຳໄລສະເລ່ຍຕໍ່ອໍເດີມີແຕ່ ` +
            `${money(econ.marginPerOrder)} — ຂາດທຶນ ${money(cac - econ.marginPerOrder)} ຕໍ່ອໍເດີ`,
          impact: `ຕ້ອງຫຼຸດຄ່າໂຄສະນາລົງ ${whole(1 - safeDiv(econ.marginPerOrder, cac))} ຫຼື ຂຶ້ນລາຄາ/ຫຼຸດຕົ້ນທຶນ`,
          confidence: confidenceFrom(totals.delivered, MIN_DELIVERED),
          sample: `${formatInt(totals.delivered)} ອໍເດີສົ່ງສຳເລັດ · ${money(t.spendLak)} ຄ່າໂຄສະນາ`,
          href: `/campaigns/${id}`,
        });
      }
    }

    // ---- ຄົນທັກຫຼາຍ ແຕ່ປິດການຂາຍຕ່ຳກວ່າຄ່າສະເລ່ຍຢ່າງຊັດເຈນ
    if (
      t.messages >= MIN_MESSAGES_FOR_CLOSE_RATE &&
      baseCloseRate > 0 &&
      allDelivered >= MIN_DELIVERED
    ) {
      const rate = safeDiv(totals.delivered, t.messages);
      if (rate < baseCloseRate * 0.5) {
        out.push({
          id: `watch:close:${id}`,
          kind: "watch",
          title: `"${name}" ຄົນທັກຫຼາຍ ແຕ່ປິດການຂາຍໄດ້ໜ້ອຍ`,
          reason:
            `ອັດຕາປິດ ${whole(rate)} ຕ່ຳກວ່າຄ່າສະເລ່ຍ ${whole(baseCloseRate)} ` +
            `(${formatInt(t.messages)} ຄົນທັກ → ${formatInt(totals.delivered)} ອໍເດີສຳເລັດ)`,
          impact:
            "ມັກເປັນເລື່ອງຄຸນນະພາບຄົນທັກ ຫຼື ການຕອບແຊັດ — ກວດຂໍ້ຄວາມໂຄສະນາວ່າກົງກັບສິນຄ້າຈິງບໍ່",
          confidence: confidenceFrom(t.messages, MIN_MESSAGES_FOR_CLOSE_RATE),
          sample: `${formatInt(t.messages)} ຄົນທັກ`,
          href: `/campaigns/${id}`,
        });
      }
    }
  }

  return out;
}

/**
 * ບອກຢ່າງກົງໄປກົງມາວ່າ **ຍັງຕັດສິນອັນໃດບໍ່ໄດ້ ແລະ ຂາດຫຍັງ** —
 * ສຳຄັນເທົ່າກັບຄຳແນະນຳ ເພາະກັນຄົນເຊື່ອຕົວເລກທີ່ຍັງບໍ່ຄົບ.
 */
export async function adviseWaiting(
  range: DateRange,
  money: MoneyFn,
  econ: OrderEconomicsSummary | null,
): Promise<Advice[]> {
  if (econ) return [];

  const [adRows, delivered] = await Promise.all([
    prisma.insight.findMany({
      where: {
        ...totalsScope,
        date: { gte: parseDate(range.from), lte: parseDate(range.to) },
      },
    }),
    prisma.order.count({
      where: {
        status: "DELIVERED",
        date: { gte: parseDate(range.from), lte: parseDate(range.to) },
      },
    }),
  ]);

  const t = aggregate(adRows);
  if (t.spendLak <= 0) return [];

  return [
    {
      id: "wait:orders",
      kind: "wait",
      title: "ຍັງບອກບໍ່ໄດ້ວ່າແຄມເປນໃດເຮັດເງິນ",
      reason:
        `ຊ່ວງນີ້ໃຊ້ ${money(t.spendLak)} ໄດ້ ${formatInt(t.messages)} ຄົນທັກ ` +
        `ແຕ່ມີອໍເດີສົ່ງສຳເລັດພຽງ ${formatInt(delivered)} ລາຍການ ` +
        `(ຕ້ອງການ ${MIN_DELIVERED} ຂຶ້ນໄປ)`,
      impact:
        "ບັນທຶກອໍເດີທີ່ຂາຍໄດ້ພ້ອມຜູກແຄມເປນ ແລ້ວລະບົບຈະຄິດ CAC, break-even ROAS ແລະ ກຳໄລສຸດທິໃຫ້",
      confidence: "low" as Confidence,
      sample: `${formatInt(delivered)}/${MIN_DELIVERED} ອໍເດີສົ່ງສຳເລັດ`,
      href: "/orders",
    },
  ];
}

/**
 * ສະຫຼຸບເສດຖະສາດຂອງຮອບນີ້ — ສະແດງສະເໝີເມື່ອມີອໍເດີພຽງພໍ
 * ບໍ່ວ່າຜົນຈະດີ ຫຼື ບໍ່ດີ ເພາະຕົວເລກເຫຼົ່ານີ້ຄືສິ່ງທີ່ຄົນຕ້ອງເບິ່ງທຸກມື້.
 */
export function adviseEconomicsSummary(
  econ: OrderEconomicsSummary,
  money: MoneyFn,
): Advice[] {
  const healthy = econ.contributionProfit >= 0;
  const cushion = safeDiv(econ.actualRoas, econ.breakEvenRoas);

  return [
    {
      id: "info:economics",
      kind: "info",
      title: healthy
        ? `ກຳໄລສຸດທິ ${money(econ.contributionProfit)} ໃນຮອບນີ້`
        : `ຂາດທຶນ ${money(Math.abs(econ.contributionProfit))} ໃນຮອບນີ້`,
      reason:
        `ROAS ຈິງ ${econ.actualRoas.toFixed(2)}x · ຕ້ອງໄດ້ຢ່າງໜ້ອຍ ` +
        `${econ.breakEvenRoas.toFixed(2)}x ຈຶ່ງຄຸ້ມທຶນ · ` +
        `ຄ່າໂຄສະນາຕໍ່ອໍເດີ ${money(safeDiv(econ.adSpend, econ.delivered))} ` +
        `ຈາກເພດານ ${money(econ.marginPerOrder)}`,
      impact:
        `ອັດຕາສົ່ງສຳເລັດ ${whole(econ.deliveryRate)} ` +
        `(ຕີກັບ ${formatInt(econ.returned)} ຈາກ ${formatInt(econ.delivered + econ.returned)}) · ` +
        (healthy
          ? `ຍັງເພີ່ມຄ່າໂຄສະນາໄດ້ອີກ ${cushion > 1 ? whole(cushion - 1) : "0%"} ກ່ອນຮອດຈຸດຄຸ້ມທຶນ`
          : `ຕ້ອງຫຼຸດຄ່າໂຄສະນາ ຫຼື ເພີ່ມກຳໄລຕໍ່ອໍເດີ`),
      confidence: confidenceFrom(econ.delivered, MIN_DELIVERED),
      sample: `${formatInt(econ.delivered)} ອໍເດີສົ່ງສຳເລັດ · ${money(econ.adSpend)} ຄ່າໂຄສະນາ`,
      href: "/orders",
    },
  ];
}
