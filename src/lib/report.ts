import { prisma } from "./prisma";
import { parseDate, toDateInput, formatDateLao, type DateRange } from "./date";
import { derive, groupTotals, type Derived } from "./metrics";
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

export type ReportRow = Derived & {
  key: string;
  label: string;
  href?: string;
};

/**
 * ດຶງແຖວ Insight ໃນຊ່ວງວັນ ແລ້ວຈັດກຸ່ມຕາມມິຕິທີ່ເລືອກ.
 * ຂໍ້ມູນລາຍວັນມີປະລິມານນ້ອຍ ຈຶ່ງລວມຢູ່ JS ໄດ້ ແລະ ຄິດຕົວຊີ້ວັດເທິງຍອດລວມທີ່ຖືກຕ້ອງ
 * (ບໍ່ແມ່ນຄ່າສະເລ່ຍຂອງອັດຕາສ່ວນ ຊຶ່ງຈະຜິດ).
 */
export async function buildReport(
  range: DateRange,
  groupBy: GroupBy,
): Promise<{ rows: ReportRow[]; totals: Derived }> {
  const insights = await prisma.insight.findMany({
    where: {
      ...totalsScope,
      date: { gte: parseDate(range.from), lte: parseDate(range.to) },
    },
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
  });

  type Row = (typeof insights)[number];

  const keyOf = (r: Row): string => {
    switch (groupBy) {
      case "campaign":
        return r.campaignId ?? `acct:${r.adAccountId}`;
      case "account":
        return r.adAccountId;
      case "product":
        return r.campaign?.productId ?? "none";
      case "objective":
        return r.campaign?.objective ?? "none";
      case "page":
        return r.campaign?.pageId ?? "none";
      case "day":
        return toDateInput(r.date);
    }
  };

  const labelOf = (r: Row): string => {
    switch (groupBy) {
      case "campaign":
        return r.campaign?.name ?? `${r.adAccount.name} (ລະດັບບັນຊີ)`;
      case "account":
        return r.adAccount.name;
      case "product":
        return r.campaign?.product?.name ?? "ບໍ່ໄດ້ຜູກສິນຄ້າ";
      case "objective":
        return r.campaign ? OBJECTIVE_LABEL[r.campaign.objective] : "ບໍ່ລະບຸ";
      case "page":
        return r.campaign?.page?.name ?? "ບໍ່ໄດ້ຜູກເພຈ";
      case "day":
        return formatDateLao(r.date);
    }
  };

  const labels = new Map<string, string>();
  const hrefs = new Map<string, string>();
  for (const r of insights) {
    const key = keyOf(r);
    if (!labels.has(key)) labels.set(key, labelOf(r));
    if (groupBy === "campaign" && r.campaignId) {
      hrefs.set(key, `/campaigns/${r.campaignId}`);
    }
  }

  const grouped = groupTotals(insights, keyOf);

  const rows: ReportRow[] = [...grouped.entries()].map(([key, totals]) => ({
    key,
    label: labels.get(key) ?? key,
    href: hrefs.get(key),
    ...derive(totals),
  }));

  rows.sort((a, b) =>
    groupBy === "day" ? a.key.localeCompare(b.key) : b.spendLak - a.spendLak,
  );

  const totals = derive(
    [...grouped.values()].reduce(
      (acc, t) => {
        for (const k of Object.keys(acc) as (keyof typeof acc)[]) acc[k] += t[k];
        return acc;
      },
      {
        spendLak: 0,
        impressions: 0,
        reach: 0,
        clicks: 0,
        linkClicks: 0,
        messages: 0,
        leadsCount: 0,
        purchases: 0,
        revenue: 0,
        videoViews: 0,
      },
    ),
  );

  return { rows, totals };
}
