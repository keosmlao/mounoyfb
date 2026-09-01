import "server-only";

import { prisma } from "./prisma";
import { addDays, daysAgo, parseDate, todayStr } from "./date";
import { aggregate } from "./metrics";
import { totalsScope } from "./scope";
import { orderEconomics } from "./advice-rules";
import { buildQueue, summarize, type ThreadInput } from "./queue";
import { buildBillingSummary, type AccountBilling } from "./billing";
import { buildTarget, planAll, type CampaignPlay } from "./playbook";
import { EntityStatus } from "@/generated/prisma/enums";
import type { MoneyFn } from "./money";

/**
 * "ດຽວນີ້ຕ້ອງເຮັດຫຍັງ" — ລວມສັນຍານຂອງທຸກໜ້າມາໄວ້ບ່ອນດຽວໃຫ້ໜ້າຫຼັກ.
 *
 * ໜ້າຫຼັກເດີມຕອບໄດ້ແຕ່ "ຜົນເປັນແນວໃດ" (ກຳໄລ · ກຣາຟ · ອັນດັບແຄມເປນ)
 * ເຊິ່ງເປັນອະດີດ. ສ່ວນສິ່ງທີ່ເສຍເງິນຈິງແມ່ນສິ່ງທີ່ຄ້າງຢູ່**ດຽວນີ້** —
 * ຄົນທັກທີ່ບໍ່ມີໃຜຕອບ, ແຄມເປນທີ່ຄວນຕັດ, ໜີ້ຄ່າໂຄສະນາທີ່ຮອດກຳນົດ.
 *
 * ຕົວຄິດຢູ່ `queue.ts` · `playbook.ts` · `billing.ts` (ບໍລິສຸດ ແລະ ມີ test ຄຸມ)
 * ໄຟລ໌ນີ້ພຽງແຕ່ອ່ານຖານຂໍ້ມູນມາປ້ອນໃຫ້.
 */

/** ຫ້ອງທີ່ບໍ່ມີຂໍ້ຄວາມມາເກີນນີ້ ຕອບບໍ່ໄດ້ອີກແລ້ວ — ບໍ່ຕ້ອງເອົາມາຄິດ */
const QUEUE_LOOKBACK_DAYS = 3;
/** ຊ່ວງທີ່ໃຊ້ຄິດເປົ້າ ແລະ ຜົນຂອງແຄມເປນ */
const CAMPAIGN_DAYS = 30;
/** ຊ່ວງທີ່ໃຊ້ຫາຄ່າໂຄສະນາສະເລ່ຍຕໍ່ວັນ */
const RECENT_DAYS = 7;

export type TodayFocus = {
  queue: {
    waiting: number;
    urgent: number;
    expired: number;
    longestWait: number;
    autoRepliedOnly: number;
  };
  campaigns: {
    /** ແຄມເປນທີ່ຕ້ອງລົງມືມື້ນີ້ (ຕັດ / ເພີ່ມງົບ / ປ່ຽນຮູບ) */
    plays: CampaignPlay[];
    active: number;
    /** ຄ່າຕໍ່ຄົນທັກສູງສຸດທີ່ຮັບໄດ້ — 0 = ຍັງຄິດບໍ່ໄດ້ */
    target: number;
  };
  billing: {
    dueLak: number;
    owing: number;
    stale: boolean;
  };
};

export async function loadTodayFocus(money: MoneyFn): Promise<TodayFocus> {
  const today = todayStr();
  const from = parseDate(addDays(today, -(CAMPAIGN_DAYS - 1)));
  const to = parseDate(today);
  const recentFrom = parseDate(addDays(today, -(RECENT_DAYS - 1)));

  const [threads, econ, insights, campaigns, accounts, allTime, recent, fxSetting] =
    await Promise.all([
      prisma.fbThread.findMany({
        where: {
          handled: false,
          lastMessageAt: { gte: daysAgo(QUEUE_LOOKBACK_DAYS) },
        },
        select: {
          id: true,
          personName: true,
          snippet: true,
          assignee: true,
          handled: true,
          leadId: true,
          page: { select: { name: true } },
          messages: {
            orderBy: { sentAt: "asc" },
            take: 40,
            select: { fromPage: true, sentAt: true },
          },
        },
      }),
      orderEconomics({ from: addDays(today, -(CAMPAIGN_DAYS - 1)), to: today }),
      prisma.insight.findMany({
        where: { ...totalsScope, date: { gte: from, lte: to } },
        select: { spendLak: true, messages: true, campaignId: true },
      }),
      prisma.campaign.findMany({
        where: { status: EntityStatus.ACTIVE },
        select: {
          id: true,
          name: true,
          startDate: true,
          createdAt: true,
          dailyBudget: true,
        },
      }),
      prisma.adAccount.findMany(),
      prisma.insight.groupBy({
        by: ["adAccountId"],
        where: totalsScope,
        _sum: { spendLak: true, spend: true },
      }),
      prisma.insight.groupBy({
        by: ["adAccountId"],
        where: { ...totalsScope, date: { gte: recentFrom, lte: to } },
        _sum: { spendLak: true },
      }),
      prisma.appSetting.findUnique({ where: { key: "defaultFxRateToLak" } }),
    ]);

  // ---- ຄິວວຽກ
  const queueInput: ThreadInput[] = threads.map((t) => ({
    id: t.id,
    personName: t.personName,
    pageName: t.page.name,
    snippet: t.snippet,
    assignee: t.assignee,
    handled: t.handled,
    leadId: t.leadId,
    messages: t.messages,
  }));
  const queue = summarize(buildQueue(queueInput));

  // ---- ຄຳສັ່ງແຄມເປນ
  const target = buildTarget({
    marginPerOrder: econ?.marginPerOrder ?? 0,
    orders: econ?.delivered ?? 0,
    messages: aggregate(insights).messages,
  });

  const byCampaign = new Map<string, { spendLak: number; messages: number }>();
  for (const row of insights) {
    if (!row.campaignId) continue;
    const cur = byCampaign.get(row.campaignId) ?? { spendLak: 0, messages: 0 };
    cur.spendLak += row.spendLak;
    cur.messages += row.messages;
    byCampaign.set(row.campaignId, cur);
  }

  const plays = planAll(
    campaigns.map((c) => {
      const stat = byCampaign.get(c.id) ?? { spendLak: 0, messages: 0 };
      const start = (c.startDate ?? c.createdAt).toISOString().slice(0, 10);
      const ageDays = Math.max(
        0,
        Math.floor(
          (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) /
            86_400_000,
        ),
      );
      return {
        id: c.id,
        name: c.name,
        ageDays,
        messages: stat.messages,
        spendLak: stat.spendLak,
        dailyBudget: c.dailyBudget,
      };
    }),
    target,
    money,
  ).filter(
    (p) => p.action === "cut" || p.action === "scale" || p.action === "creative",
  );

  // ---- ຄ່າໂຄສະນາທີ່ຄ້າງຊຳລະ
  const allTimeMap = new Map(allTime.map((r) => [r.adAccountId, r._sum]));
  const recentMap = new Map(recent.map((r) => [r.adAccountId, r._sum]));
  const billingInput: AccountBilling[] = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    currency: a.currency,
    fbAccountId: a.fbAccountId,
    fundingSource: a.fbFundingSource,
    balance: a.fbBalance,
    amountSpent: a.fbAmountSpent,
    spendCap: a.fbSpendCap,
    billingAt: a.fbBillingAt,
    recentSpendLak: recentMap.get(a.id)?.spendLak ?? 0,
    recentDays: RECENT_DAYS,
    insightSpend: allTimeMap.get(a.id)?.spend ?? 0,
    insightSpendLak: allTimeMap.get(a.id)?.spendLak ?? 0,
  }));
  const billing = buildBillingSummary(billingInput, Number(fxSetting?.value) || 0);

  return {
    queue: {
      waiting: queue.total,
      urgent: queue.urgent,
      expired: queue.expired,
      longestWait: queue.longestWait,
      autoRepliedOnly: queue.autoRepliedOnly,
    },
    campaigns: {
      plays,
      active: campaigns.length,
      target: target.costPerMessage,
    },
    billing: {
      dueLak: billing.dueLak,
      owing: billing.owing,
      stale: billing.rows.some((r) => r.stale),
    },
  };
}
