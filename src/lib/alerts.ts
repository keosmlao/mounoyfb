import { prisma } from "./prisma";
import { addDays, parseDate, toDateInput, formatDateLao, todayStr } from "./date";
import { formatMoney, formatPercent, safeDiv } from "./format";
import { loadMoney } from "./money-server";
import { totalsScope } from "./scope";
import { sumOrderTotals } from "./orders";
import { getFbConfig, readTokenState } from "./fb";
import { getAutoSync, inboxState } from "./auto-sync";
import {
  DEFAULT_SYNC_STALE_HOURS,
  evaluateSyncHealth,
  fxGapAlert,
  missingFxDays,
  type SpendDay,
} from "./sync-health";
import { sortAlerts, type Alert } from "./alert-types";

export {
  SEVERITY_ORDER,
  SEVERITY_LABEL,
  SEVERITY_TONE,
  SEVERITY_ICON,
  countActionable,
  sortAlerts,
  type Severity,
  type Alert,
} from "./alert-types";

/**
 * ເຄື່ອງກວດເຕືອນ — ອ່ານຂໍ້ມູນທີ່ບັນທຶກໄວ້ ແລ້ວບອກວ່າມີຫຍັງຕ້ອງເບິ່ງ.
 * ບໍ່ໄດ້ເກັບການແຈ້ງເຕືອນລົງຖານຂໍ້ມູນ — ຄິດໃໝ່ທຸກຄັ້ງທີ່ເປີດໜ້າ
 * ຈຶ່ງບໍ່ມີບັນຫາການແຈ້ງເຕືອນເກົ່າຄ້າງຄາເມື່ອຂໍ້ມູນຖືກແກ້.
 */

export type Thresholds = {
  dailyBudgetTolerancePct: number;
  lifetimeBudgetPct: number;
  roasMin: number;
  costPerMessageMax: number;
  staleLeadDays: number;
  endingSoonDays: number;
  /** ບໍ່ມີການດຶງສຳເລັດດົນກວ່ານີ້ (ຊົ່ວໂມງ) = ເຕືອນວ່າຂໍ້ມູນຄ້າງ */
  syncStaleHours: number;
};

export const DEFAULT_THRESHOLDS: Thresholds = {
  dailyBudgetTolerancePct: 10,
  lifetimeBudgetPct: 80,
  roasMin: 1,
  costPerMessageMax: 0, // 0 = ປິດການກວດນີ້
  staleLeadDays: 3,
  endingSoonDays: 3,
  syncStaleHours: DEFAULT_SYNC_STALE_HOURS,
};

export const THRESHOLD_KEYS: Record<keyof Thresholds, string> = {
  dailyBudgetTolerancePct: "alertDailyBudgetTolerancePct",
  lifetimeBudgetPct: "alertLifetimeBudgetPct",
  roasMin: "alertRoasMin",
  costPerMessageMax: "alertCostPerMessageMax",
  staleLeadDays: "alertStaleLeadDays",
  endingSoonDays: "alertEndingSoonDays",
  syncStaleHours: "alertSyncStaleHours",
};

export async function getThresholds(): Promise<Thresholds> {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: Object.values(THRESHOLD_KEYS) } },
  });
  const map = new Map(rows.map((r) => [r.key, Number(r.value)]));

  const out = { ...DEFAULT_THRESHOLDS };
  for (const [field, key] of Object.entries(THRESHOLD_KEYS) as [
    keyof Thresholds,
    string,
  ][]) {
    const value = map.get(key);
    if (value !== undefined && Number.isFinite(value)) out[field] = value;
  }
  return out;
}

/** ຄິດການແຈ້ງເຕືອນທັງໝົດ ຮຽງຕາມຄວາມຮ້າຍແຮງ */
export async function buildAlerts(): Promise<Alert[]> {
  const { money } = await loadMoney();
  const thresholds = await getThresholds();
  const today = todayStr();
  const yesterday = addDays(today, -1);
  const weekAgo = addDays(today, -7);

  // ຊ່ວງທີ່ກວດອັດຕາແລກປ່ຽນ — ບໍ່ນັບມື້ນີ້ ເພາະຍັງປ້ອນບໍ່ທັນກໍ່ບໍ່ຜິດຫຍັງ
  const fxFrom = addDays(today, -14);

  const [
    campaigns,
    accounts,
    yesterdayRows,
    weekRows,
    weekOrders,
    allTimeByCampaign,
    staleLeads,
    fbConfig,
    autoSync,
    inbox,
    tokenState,
    lastSync,
    lastSuccess,
    spendDayRows,
    rateRows,
  ] = await Promise.all([
    prisma.campaign.findMany({
      where: { status: { in: ["ACTIVE", "PAUSED"] } },
      include: { adAccount: { select: { name: true, currency: true } } },
    }),
    prisma.adAccount.findMany({ where: { spendCap: { not: null } } }),
    prisma.insight.findMany({
      where: { ...totalsScope, date: parseDate(yesterday) },
      select: { campaignId: true, spend: true, spendLak: true },
    }),
    prisma.insight.groupBy({
      by: ["campaignId"],
      where: {
        ...totalsScope,
        date: { gte: parseDate(weekAgo), lte: parseDate(today) },
      },
      _sum: { spendLak: true, messages: true },
    }),
    prisma.order.findMany({
      where: {
        date: { gte: parseDate(weekAgo), lte: parseDate(today) },
        campaignId: { not: null },
      },
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
    prisma.insight.groupBy({
      by: ["campaignId", "adAccountId"],
      where: totalsScope,
      _sum: { spend: true },
    }),
    prisma.lead.count({
      where: {
        status: "NEW",
        date: { lt: parseDate(addDays(today, -thresholds.staleLeadDays)) },
      },
    }),
    // --- ສຸຂະພາບຂອງລະບົບເອງ (token / ການດຶງ / ກ່ອງຂໍ້ຄວາມ) ---
    getFbConfig(),
    getAutoSync(),
    inboxState(),
    readTokenState(),
    prisma.syncLog.findFirst({
      orderBy: { startedAt: "desc" },
      select: { status: true, startedAt: true, message: true },
    }),
    prisma.syncLog.findFirst({
      where: { status: "SUCCESS" },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true, finishedAt: true },
    }),
    // --- ວັນທີ່ໃຊ້ເງິນຈິງ ທຽບກັບອັດຕາແລກປ່ຽນທີ່ປ້ອນໄວ້ ---
    prisma.insight.groupBy({
      by: ["date", "currency"],
      where: {
        ...totalsScope,
        date: { gte: parseDate(fxFrom), lte: parseDate(yesterday) },
        spend: { gt: 0 },
      },
    }),
    prisma.exchangeRate.findMany({
      where: { date: { gte: parseDate(fxFrom), lte: parseDate(yesterday) } },
      select: { date: true, currency: true },
    }),
  ]);

  const alerts: Alert[] = [];

  // 0) ສຸຂະພາບຂອງລະບົບເອງ — ຕ້ອງກວດກ່ອນໝູ່ ເພາະຖ້າການດຶງພັງ
  //    ຕົວເລກທຸກອັນຂ້າງລຸ່ມນີ້ກໍ່ເປັນຂອງເກົ່າ ແລ້ວຄຳເຕືອນອື່ນຈະພາຄິດຜິດ
  alerts.push(
    ...evaluateSyncHealth({
      connected: fbConfig !== null,
      autoSyncEnabled: autoSync.enabled,
      lastSync,
      // ຮອບທີ່ສຳເລັດແລ້ວຕ້ອງມີ finishedAt — ເອົາ startedAt ກັນໄວ້ເສີຍໆ
      lastSuccessAt: lastSuccess?.finishedAt ?? lastSuccess?.startedAt ?? null,
      token: tokenState,
      inboxEnabled: inbox.settings.enabled,
      inboxError: inbox.error,
      staleHours: thresholds.syncStaleHours,
      now: new Date(),
    }),
  );

  // 0b) ວັນທີ່ໃຊ້ເງິນຈິງ ແຕ່ບໍ່ໄດ້ປ້ອນອັດຕາແລກປ່ຽນ — ຍອດກີບຈະເພື້ອນຢ່າງງຽບໆ
  const toSpendDay = (r: { date: Date; currency: string }): SpendDay => ({
    date: toDateInput(r.date),
    currency: r.currency,
  });
  const fxAlert = fxGapAlert(
    missingFxDays(spendDayRows.map(toSpendDay), rateRows.map(toSpendDay)),
  );
  if (fxAlert) alerts.push(fxAlert);

  const yesterdayByCampaign = new Map<string, number>();
  for (const row of yesterdayRows) {
    if (!row.campaignId) continue;
    yesterdayByCampaign.set(
      row.campaignId,
      (yesterdayByCampaign.get(row.campaignId) ?? 0) + row.spend,
    );
  }

  const weekByCampaign = new Map(
    weekRows.map((r) => [
      r.campaignId as string,
      {
        spendLak: r._sum.spendLak ?? 0,
        messages: r._sum.messages ?? 0,
      },
    ]),
  );

  const orderRowsByCampaign = new Map<string, typeof weekOrders>();
  for (const row of weekOrders) {
    if (!row.campaignId) continue;
    const list = orderRowsByCampaign.get(row.campaignId) ?? [];
    list.push(row);
    orderRowsByCampaign.set(row.campaignId, list);
  }

  const spendByCampaign = new Map<string, number>();
  const spendByAccount = new Map<string, number>();
  for (const row of allTimeByCampaign) {
    const spend = row._sum.spend ?? 0;
    if (row.campaignId) spendByCampaign.set(row.campaignId, spend);
    spendByAccount.set(
      row.adAccountId,
      (spendByAccount.get(row.adAccountId) ?? 0) + spend,
    );
  }

  for (const campaign of campaigns) {
    const currency = campaign.adAccount.currency;
    const href = `/campaigns/${campaign.id}`;

    // 1) ໃຊ້ເກີນງົບຕໍ່ວັນ (ທຽບເປັນສະກຸນຂອງບັນຊີ ບໍ່ແມ່ນກີບ)
    const spentYesterday = yesterdayByCampaign.get(campaign.id);
    if (campaign.dailyBudget && spentYesterday !== undefined) {
      const limit = campaign.dailyBudget * (1 + thresholds.dailyBudgetTolerancePct / 100);
      if (spentYesterday > limit) {
        const overPct = safeDiv(spentYesterday - campaign.dailyBudget, campaign.dailyBudget);
        alerts.push({
          id: `over-daily:${campaign.id}`,
          severity: overPct > 0.5 ? "serious" : "warning",
          category: "ງົບປະມານ",
          title: `ໃຊ້ເກີນງົບຕໍ່ວັນ: ${campaign.name}`,
          detail: `ວັນທີ່ ${formatDateLao(yesterday)} ໃຊ້ ${formatMoney(
            spentYesterday,
            currency,
          )} ຈາກງົບ ${formatMoney(campaign.dailyBudget, currency)} (ເກີນ ${formatPercent(
            overPct,
            0,
          )})`,
          href,
        });
      }
    }

    // 2) ງົບລວມທັງແຄມເປນໃກ້ໝົດ
    if (campaign.lifetimeBudget && campaign.lifetimeBudget > 0) {
      const used = spendByCampaign.get(campaign.id) ?? 0;
      const pct = used / campaign.lifetimeBudget;
      if (pct >= thresholds.lifetimeBudgetPct / 100) {
        alerts.push({
          id: `lifetime:${campaign.id}`,
          severity: pct >= 1 ? "critical" : "serious",
          category: "ງົບປະມານ",
          title:
            pct >= 1
              ? `ງົບລວມໝົດແລ້ວ: ${campaign.name}`
              : `ງົບລວມໃກ້ໝົດ: ${campaign.name}`,
          detail: `ໃຊ້ໄປ ${formatMoney(used, currency)} ຈາກ ${formatMoney(
            campaign.lifetimeBudget,
            currency,
          )} (${formatPercent(pct, 0)})`,
          href,
        });
      }
    }

    // 3) ROAS ຕ່ຳ — ກວດສະເພາະແຄມເປນທີ່ຄາດຫວັງຍອດຂາຍ
    const expectsRevenue =
      campaign.objective === "SALES" || campaign.objective === "MESSAGES";
    const week = weekByCampaign.get(campaign.id);
    const actualOrders = sumOrderTotals(orderRowsByCampaign.get(campaign.id) ?? []);
    const hasClosedOrders = actualOrders.delivered + actualOrders.returned > 0;
    if (expectsRevenue && week && week.spendLak > 0 && hasClosedOrders) {
      const roas = safeDiv(actualOrders.netRevenue, week.spendLak);
      if (roas < thresholds.roasMin) {
        alerts.push({
          id: `roas:${campaign.id}`,
          severity: roas < thresholds.roasMin / 2 ? "serious" : "warning",
          category: "ຜົນຕອບແທນ",
          title: `Actual ROAS ຕ່ຳກວ່າເປົ້າ: ${campaign.name}`,
          detail: `7 ວັນຫຼ້າສຸດ Actual ROAS ${roas.toFixed(2)}x (ເປົ້າ ${thresholds.roasMin}x) · ໃຊ້ ${money(
            week.spendLak,
          )} ໄດ້ຍອດຂາຍຈິງ ${money(actualOrders.netRevenue)} ຈາກ ${actualOrders.delivered} Order ສົ່ງສຳເລັດ`,
          href,
        });
      }
    }

    // 4) ຄ່າຕໍ່ 1 ຄົນທັກ ສູງເກີນທີ່ຕັ້ງໄວ້
    if (thresholds.costPerMessageMax > 0 && week && week.messages > 0) {
      const costPerMessage = safeDiv(week.spendLak, week.messages);
      if (costPerMessage > thresholds.costPerMessageMax) {
        alerts.push({
          id: `cpm-msg:${campaign.id}`,
          severity: "warning",
          category: "ຕົ້ນທຶນ",
          title: `ຄ່າຕໍ່ຄົນທັກສູງ: ${campaign.name}`,
          detail: `7 ວັນຫຼ້າສຸດ ${money(costPerMessage)} ຕໍ່ 1 ຄົນ (ຕັ້ງເພດານໄວ້ ${money(
            thresholds.costPerMessageMax,
          )})`,
          href,
        });
      }
    }

    // 5) ແຄມເປນທີ່ກຳລັງຍິງ ແຕ່ບໍ່ມີຂໍ້ມູນມື້ວານ — ແປວ່າຍັງບໍ່ໄດ້ດຶງ
    //    (ຕັ້ງແຕ່ຕໍ່ Facebook ແລ້ວ ຂໍ້ມູນຄວນມາເອງ ຈຶ່ງເປັນສັນຍານວ່າ sync ຄ້າງ)
    if (campaign.status === "ACTIVE" && spentYesterday === undefined) {
      alerts.push({
        id: `missing:${campaign.id}`,
        severity: "info",
        category: "ຂໍ້ມູນ",
        title: `ຍັງບໍ່ໄດ້ດຶງຂໍ້ມູນ: ${campaign.name}`,
        detail:
          `ບໍ່ມີຜົນຂອງວັນທີ່ ${formatDateLao(yesterday)} — ` +
          `ໄປໜ້າ ຕັ້ງຄ່າ ແລ້ວກົດ “ດຶງຂໍ້ມູນດຽວນີ້”`,
        href: "/settings",
      });
    }

    // 6) ໃກ້ຮອດວັນສິ້ນສຸດ
    if (campaign.status === "ACTIVE" && campaign.endDate) {
      const endStr = campaign.endDate.toISOString().slice(0, 10);
      const limitStr = addDays(today, thresholds.endingSoonDays);
      if (endStr >= today && endStr <= limitStr) {
        alerts.push({
          id: `ending:${campaign.id}`,
          severity: "info",
          category: "ກຳນົດເວລາ",
          title: `ໃກ້ຮອດວັນສິ້ນສຸດ: ${campaign.name}`,
          detail: `ຈະສິ້ນສຸດວັນທີ່ ${formatDateLao(endStr)}`,
          href,
        });
      }
    }
  }

  // 7) ບັນຊີໃກ້ເຖິງເພດານຄ່າໃຊ້ຈ່າຍ
  for (const account of accounts) {
    const cap = account.spendCap;
    if (!cap || cap <= 0) continue;
    const used = spendByAccount.get(account.id) ?? 0;
    const pct = used / cap;
    if (pct >= thresholds.lifetimeBudgetPct / 100) {
      alerts.push({
        id: `cap:${account.id}`,
        severity: pct >= 1 ? "critical" : "serious",
        category: "ງົບປະມານ",
        title:
          pct >= 1
            ? `ບັນຊີເຖິງເພດານແລ້ວ: ${account.name}`
            : `ບັນຊີໃກ້ເຖິງເພດານ: ${account.name}`,
        detail: `ໃຊ້ໄປ ${formatMoney(used, account.currency)} ຈາກເພດານ ${formatMoney(
          cap,
          account.currency,
        )} (${formatPercent(pct, 0)})`,
        href: `/ad-accounts/${account.id}`,
      });
    }
  }

  // 8) ລູກຄ້າໃໝ່ຄ້າງບໍ່ໄດ້ຕິດຕໍ່
  if (staleLeads > 0) {
    alerts.push({
      id: "stale-leads",
      severity: staleLeads >= 10 ? "serious" : "warning",
      category: "ລູກຄ້າ",
      title: `ລູກຄ້າ ${staleLeads} ຄົນ ຍັງບໍ່ໄດ້ຕິດຕໍ່`,
      detail: `ຄ້າງຢູ່ສະຖານະ “ໃໝ່” ເກີນ ${thresholds.staleLeadDays} ວັນ — ຈ່າຍຄ່າໂຄສະນາໄປແລ້ວແຕ່ຍັງບໍ່ໄດ້ຕາມ`,
      href: "/leads?status=NEW",
    });
  }

  return sortAlerts(alerts);
}
