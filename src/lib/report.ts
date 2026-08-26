import { prisma } from "./prisma";
import { parseDate, toDateInput, formatDateLao, type DateRange } from "./date";
import {
  derive,
  groupTotals,
  EMPTY_TOTALS,
  type Derived,
  type Totals,
} from "./metrics";
import {
  deriveOrderEconomics,
  groupOrderTotals,
  sumOrderTotals,
  EMPTY_ORDER_TOTALS,
  type OrderEconomics,
} from "./orders";
import { OBJECTIVE_LABEL } from "./labels";
import { totalsScope } from "./scope";

export const GROUP_BYS = {
  campaign: "ຕາມແຄມເປນ",
  account: "ຕາມບັນຊີໂຄສະນາ",
  product: "ຕາມສິນຄ້າ",
  objective: "ຕາມເປົ້າໝາຍ",
  day: "ຕາມວັນ",
  page: "ຕາມເພຈ",
} as const;

export type GroupBy = keyof typeof GROUP_BYS;

export type ReportRow = Derived &
  OrderEconomics & {
    key: string;
    label: string;
    href?: string;
    hasOrderData: boolean;
  };

export type ReportTotals = Derived & OrderEconomics & { hasOrderData: boolean };

/**
 * ລວມ 2 ແຫຼ່ງໂດຍບໍ່ປົນຄວາມໝາຍ:
 * - Insight = ຜົນທີ່ Meta ລາຍງານ (spend, message, Meta purchase)
 * - Order = ຍອດຂາຍຈິງຂອງຮ້ານ (delivered, cost, return)
 */
export async function buildReport(
  range: DateRange,
  groupBy: GroupBy,
): Promise<{ rows: ReportRow[]; totals: ReportTotals }> {
  const dateWhere = { gte: parseDate(range.from), lte: parseDate(range.to) };
  const [insights, orders] = await Promise.all([
    prisma.insight.findMany({
      where: { ...totalsScope, date: dateWhere },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            objective: true,
            productId: true,
            pageId: true,
            product: { select: { name: true } },
            page: { select: { name: true } },
          },
        },
        adAccount: { select: { id: true, name: true } },
      },
    }),
    prisma.order.findMany({
      where: { date: dateWhere },
      include: {
        product: { select: { name: true } },
        campaign: {
          select: {
            id: true,
            name: true,
            objective: true,
            productId: true,
            pageId: true,
            adAccount: { select: { id: true, name: true } },
            product: { select: { name: true } },
            page: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  type InsightRow = (typeof insights)[number];
  type OrderRow = (typeof orders)[number];

  const insightKey = (r: InsightRow): string => {
    switch (groupBy) {
      case "campaign": return r.campaignId ?? "none";
      case "account": return r.adAccountId;
      case "product": return r.campaign?.productId ?? "none";
      case "objective": return r.campaign?.objective ?? "none";
      case "page": return r.campaign?.pageId ?? "none";
      case "day": return toDateInput(r.date);
    }
  };

  const orderKey = (r: OrderRow): string => {
    switch (groupBy) {
      case "campaign": return r.campaignId ?? "none";
      case "account": return r.campaign?.adAccount.id ?? "none";
      case "product": return r.productId ?? r.campaign?.productId ?? "none";
      case "objective": return r.campaign?.objective ?? "none";
      case "page": return r.campaign?.pageId ?? "none";
      case "day": return toDateInput(r.date);
    }
  };

  const labels = new Map<string, string>();
  const hrefs = new Map<string, string>();

  for (const r of insights) {
    const key = insightKey(r);
    if (labels.has(key)) continue;
    switch (groupBy) {
      case "campaign":
        labels.set(key, r.campaign?.name ?? "ບໍ່ໄດ້ຜູກແຄມເປນ");
        if (r.campaignId) hrefs.set(key, `/campaigns/${r.campaignId}`);
        break;
      case "account": labels.set(key, r.adAccount.name); break;
      case "product": labels.set(key, r.campaign?.product?.name ?? "ບໍ່ໄດ້ຜູກສິນຄ້າ"); break;
      case "objective": labels.set(key, r.campaign ? OBJECTIVE_LABEL[r.campaign.objective] : "ບໍ່ລະບຸ"); break;
      case "page": labels.set(key, r.campaign?.page?.name ?? "ບໍ່ໄດ້ຜູກເພຈ"); break;
      case "day": labels.set(key, formatDateLao(r.date)); break;
    }
  }

  for (const r of orders) {
    const key = orderKey(r);
    if (groupBy === "campaign" && r.campaignId) hrefs.set(key, `/campaigns/${r.campaignId}`);
    if (labels.has(key)) continue;
    switch (groupBy) {
      case "campaign": labels.set(key, r.campaign?.name ?? "Organic / ບໍ່ໄດ້ຜູກແຄມເປນ"); break;
      case "account": labels.set(key, r.campaign?.adAccount.name ?? "Organic / ບໍ່ລະບຸບັນຊີ"); break;
      case "product": labels.set(key, r.product?.name ?? r.campaign?.product?.name ?? "ບໍ່ໄດ້ຜູກສິນຄ້າ"); break;
      case "objective": labels.set(key, r.campaign ? OBJECTIVE_LABEL[r.campaign.objective] : "Organic / ບໍ່ລະບຸ"); break;
      case "page": labels.set(key, r.campaign?.page?.name ?? "Organic / ບໍ່ໄດ້ຜູກເພຈ"); break;
      case "day": labels.set(key, formatDateLao(r.date)); break;
    }
  }

  const insightGroups = groupTotals(insights, insightKey);
  const orderGroups = groupOrderTotals(orders, orderKey);
  const keys = new Set([...insightGroups.keys(), ...orderGroups.keys()]);

  const rows: ReportRow[] = [...keys].map((key) => {
    const ad = derive(insightGroups.get(key) ?? { ...EMPTY_TOTALS });
    const order = orderGroups.get(key) ?? { ...EMPTY_ORDER_TOTALS };
    return {
      key,
      label: labels.get(key) ?? key,
      href: hrefs.get(key),
      ...ad,
      ...deriveOrderEconomics(order, ad.spendLak),
      hasOrderData: order.orders > 0,
    };
  });

  rows.sort((a, b) =>
    groupBy === "day"
      ? a.key.localeCompare(b.key)
      : Math.max(b.spendLak, b.netRevenue) - Math.max(a.spendLak, a.netRevenue),
  );

  const adTotals = derive(
    [...insightGroups.values()].reduce<Totals>(
      (acc, t) => {
        for (const key of Object.keys(acc) as (keyof Totals)[]) acc[key] += t[key];
        return acc;
      },
      { ...EMPTY_TOTALS },
    ),
  );
  const actual = deriveOrderEconomics(sumOrderTotals(orders), adTotals.spendLak);

  return {
    rows,
    totals: { ...adTotals, ...actual, hasOrderData: orders.length > 0 },
  };
}
