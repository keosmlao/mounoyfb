import { prisma } from "./prisma";
import { addDays, parseDate, formatDateLao, todayStr } from "./date";
import { formatLak, formatMoney, formatPercent, safeDiv } from "./format";
import { totalsScope } from "./scope";

/**
 * ເຄື່ອງກວດເຕືອນ — ອ່ານຂໍ້ມູນທີ່ບັນທຶກໄວ້ ແລ້ວບອກວ່າມີຫຍັງຕ້ອງເບິ່ງ.
 * ບໍ່ໄດ້ເກັບການແຈ້ງເຕືອນລົງຖານຂໍ້ມູນ — ຄິດໃໝ່ທຸກຄັ້ງທີ່ເປີດໜ້າ
 * ຈຶ່ງບໍ່ມີບັນຫາການແຈ້ງເຕືອນເກົ່າຄ້າງຄາເມື່ອຂໍ້ມູນຖືກແກ້.
 */

/** ຄວາມຮ້າຍແຮງ — ຮຽງຈາກໜັກໄປເບົາ */
export type Severity = "critical" | "serious" | "warning" | "info";

export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  serious: 1,
  warning: 2,
  info: 3,
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "ດ່ວນຫຼາຍ",
  serious: "ຕ້ອງເບິ່ງ",
  warning: "ລະວັງ",
  info: "ຮັບຮູ້ໄວ້",
};

export const SEVERITY_TONE: Record<Severity, string> = {
  critical: "danger",
  serious: "danger",
  warning: "warning",
  info: "info",
};

/** ໄອຄອນຄູ່ກັບປ້າຍຄຳ — ບໍ່ໃຫ້ຄວາມໝາຍຂຶ້ນກັບສີຢ່າງດຽວ */
export const SEVERITY_ICON: Record<Severity, string> = {
  critical: "⛔",
  serious: "▲",
  warning: "⚠",
  info: "ℹ",
};

export type Alert = {
  id: string;
  severity: Severity;
  category: string;
  title: string;
  detail: string;
  href?: string;
};

export type Thresholds = {
  dailyBudgetTolerancePct: number;
  lifetimeBudgetPct: number;
  roasMin: number;
  costPerMessageMax: number;
  staleLeadDays: number;
  endingSoonDays: number;
};

export const DEFAULT_THRESHOLDS: Thresholds = {
  dailyBudgetTolerancePct: 10,
  lifetimeBudgetPct: 80,
  roasMin: 1,
  costPerMessageMax: 0, // 0 = ປິດການກວດນີ້
  staleLeadDays: 3,
  endingSoonDays: 3,
};

export const THRESHOLD_KEYS: Record<keyof Thresholds, string> = {
  dailyBudgetTolerancePct: "alertDailyBudgetTolerancePct",
  lifetimeBudgetPct: "alertLifetimeBudgetPct",
  roasMin: "alertRoasMin",
  costPerMessageMax: "alertCostPerMessageMax",
  staleLeadDays: "alertStaleLeadDays",
  endingSoonDays: "alertEndingSoonDays",
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
  const thresholds = await getThresholds();
  const today = todayStr();
  const yesterday = addDays(today, -1);
  const weekAgo = addDays(today, -7);

  const [campaigns, accounts, yesterdayRows, weekRows, allTimeByCampaign, staleLeads] =
    await Promise.all([
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
        _sum: { spendLak: true, revenue: true, messages: true },
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
    ]);

  const alerts: Alert[] = [];

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
        revenue: r._sum.revenue ?? 0,
        messages: r._sum.messages ?? 0,
      },
    ]),
  );

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
    if (expectsRevenue && week && week.spendLak > 0) {
      const roas = safeDiv(week.revenue, week.spendLak);
      if (roas < thresholds.roasMin) {
        alerts.push({
          id: `roas:${campaign.id}`,
          severity: roas < thresholds.roasMin / 2 ? "serious" : "warning",
          category: "ຜົນຕອບແທນ",
          title: `ROAS ຕ່ຳກວ່າເປົ້າ: ${campaign.name}`,
          detail: `7 ວັນຫຼ້າສຸດ ROAS ${roas.toFixed(2)}x (ເປົ້າ ${thresholds.roasMin}x) · ໃຊ້ ${formatLak(
            week.spendLak,
          )} ໄດ້ຍອດຂາຍ ${formatLak(week.revenue)}`,
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
          detail: `7 ວັນຫຼ້າສຸດ ${formatLak(costPerMessage)} ຕໍ່ 1 ຄົນ (ຕັ້ງເພດານໄວ້ ${formatLak(
            thresholds.costPerMessageMax,
          )})`,
          href,
        });
      }
    }

    // 5) ແຄມເປນທີ່ກຳລັງຍິງ ແຕ່ຍັງບໍ່ໄດ້ບັນທຶກຜົນມື້ວານ
    if (campaign.status === "ACTIVE" && spentYesterday === undefined) {
      alerts.push({
        id: `missing:${campaign.id}`,
        severity: "info",
        category: "ຂໍ້ມູນ",
        title: `ຍັງບໍ່ໄດ້ບັນທຶກຜົນ: ${campaign.name}`,
        detail: `ບໍ່ມີຂໍ້ມູນຂອງວັນທີ່ ${formatDateLao(yesterday)} — ຕົວເລກລາຍງານຈະບໍ່ຄົບ`,
        href: `/insights?date=${yesterday}`,
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

  alerts.sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      a.title.localeCompare(b.title),
  );

  return alerts;
}

/** ນັບການແຈ້ງເຕືອນທີ່ຕ້ອງລົງມືເຮັດ (ບໍ່ນັບລະດັບ “ຮັບຮູ້ໄວ້”) */
export function countActionable(alerts: Alert[]): number {
  return alerts.filter((a) => a.severity !== "info").length;
}
