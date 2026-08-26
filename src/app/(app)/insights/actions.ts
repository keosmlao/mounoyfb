"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth-server";
import { int0, num, num0, reqDate, reqStr, str } from "@/lib/form";
import { toDateInput } from "@/lib/date";
import { InsightLevel } from "@/generated/prisma/enums";

/** ຄ່າຕົວເລກທັງໝົດຂອງ 1 ແຖວ */
function readMetrics(fd: FormData, suffix: string) {
  const g = (name: string) => `${name}_${suffix}`;
  return {
    spend: Math.max(0, num0(fd, g("spend"))),
    impressions: int0(fd, g("impressions")),
    reach: int0(fd, g("reach")),
    clicks: int0(fd, g("clicks")),
    linkClicks: int0(fd, g("linkClicks")),
    messages: int0(fd, g("messages")),
    leadsCount: int0(fd, g("leadsCount")),
    purchases: int0(fd, g("purchases")),
    revenue: Math.max(0, num0(fd, g("revenue"))),
    videoViews: int0(fd, g("videoViews")),
  };
}

function isAllZero(m: ReturnType<typeof readMetrics>) {
  return Object.values(m).every((v) => v === 0);
}

/**
 * ບັນທຶກຜົນລາຍວັນຫຼາຍແຄມເປນພ້ອມກັນ (ຕາຕະລາງປ້ອນໄວ).
 * ແຖວທີ່ວ່າງທັງໝົດ ແລະ ຍັງບໍ່ເຄີຍມີຂໍ້ມູນ → ຂ້າມໄປ ບໍ່ສ້າງແຖວເປົ່າ.
 */
export async function saveDailyInsights(fd: FormData) {
  await requireSession();
  const date = reqDate(fd, "date", "ວັນທີ່");
  const campaignIds = fd.getAll("campaignId").map(String).filter(Boolean);

  const campaigns = await prisma.campaign.findMany({
    where: { id: { in: campaignIds } },
    select: { id: true, adAccountId: true, adAccount: { select: { currency: true } } },
  });
  const byId = new Map(campaigns.map((c) => [c.id, c]));
  const ratesByCurrency = new Map<string, number>();

  for (const campaignId of campaignIds) {
    const campaign = byId.get(campaignId);
    if (!campaign) continue;

    const metrics = readMetrics(fd, campaignId);
    const currency = campaign.adAccount.currency;
    const fxRateToLak =
      currency === "LAK"
        ? 1
        : (num(fd, `fxRateToLak_${currency}`) ?? num(fd, "fxRateToLak") ?? 0);
    if (fxRateToLak <= 0) {
      throw new Error(`ອັດຕາແລກປ່ຽນ ${currency} ເປັນກີບຕ້ອງຫຼາຍກວ່າ 0`);
    }
    ratesByCurrency.set(currency, fxRateToLak);
    const entityKey = `CAMPAIGN:${campaignId}`;
    const existing = await prisma.insight.findUnique({
      where: { date_entityKey: { date, entityKey } },
      select: { id: true },
    });

    if (isAllZero(metrics)) {
      // ລ້າງຄ່າ: ຖ້າເຄີຍມີແຖວແລ້ວຜູ້ໃຊ້ລຶບຄ່າອອກໝົດ → ລຶບແຖວນັ້ນ
      if (existing) await prisma.insight.delete({ where: { id: existing.id } });
      continue;
    }

    const data = {
      ...metrics,
      spendLak: Math.round(metrics.spend * fxRateToLak),
      fxRateToLak,
      currency,
      adAccountId: campaign.adAccountId,
      campaignId,
      level: InsightLevel.CAMPAIGN,
      source: "MANUAL" as const,
    };

    await prisma.insight.upsert({
      where: { date_entityKey: { date, entityKey } },
      create: { date, entityKey, ...data },
      update: data,
    });
  }

  // ຈື່ອັດຕາຂອງແຕ່ລະສະກຸນແຍກກັນ ເພື່ອບໍ່ເອົາ rate USD ໄປໃຊ້ກັບສະກຸນອື່ນ.
  for (const [currency, rateToLak] of ratesByCurrency) {
    if (currency === "LAK") continue;
    await prisma.exchangeRate.upsert({
      where: { date_currency: { date, currency } },
      create: { date, currency, rateToLak },
      update: { rateToLak },
    });
  }

  revalidatePath("/insights");
  revalidatePath("/");
  redirect(`/insights?date=${toDateInput(date)}`);
}

/** ບັນທຶກ 1 ແຖວ ໃນລະດັບໃດກໍ່ໄດ້ (ບັນຊີ / ແຄມເປນ / ຊຸດ / ໂຄສະນາ) */
export async function saveSingleInsight(fd: FormData) {
  await requireSession();
  const date = reqDate(fd, "date", "ວັນທີ່");
  const levelValue = str(fd, "level") ?? "CAMPAIGN";
  if (!Object.values(InsightLevel).includes(levelValue as InsightLevel)) {
    throw new Error("ລະດັບຂໍ້ມູນບໍ່ຖືກຕ້ອງ");
  }
  const level = levelValue as InsightLevel;
  const targetId = reqStr(fd, "targetId", "ເປົ້າໝາຍ");
  let fxRateToLak = num(fd, "fxRateToLak") ?? 1;
  const metrics = readMetrics(fd, "row");

  let adAccountId = targetId;
  let campaignId: string | null = null;
  let adSetId: string | null = null;
  let adId: string | null = null;
  let currency = "USD";

  if (level === "CAMPAIGN") {
    const c = await prisma.campaign.findUniqueOrThrow({
      where: { id: targetId },
      select: { adAccountId: true, adAccount: { select: { currency: true } } },
    });
    adAccountId = c.adAccountId;
    campaignId = targetId;
    currency = c.adAccount.currency;
  } else if (level === "ADSET") {
    const s = await prisma.adSet.findUniqueOrThrow({
      where: { id: targetId },
      select: {
        campaignId: true,
        campaign: {
          select: { adAccountId: true, adAccount: { select: { currency: true } } },
        },
      },
    });
    adAccountId = s.campaign.adAccountId;
    campaignId = s.campaignId;
    adSetId = targetId;
    currency = s.campaign.adAccount.currency;
  } else if (level === "AD") {
    const a = await prisma.ad.findUniqueOrThrow({
      where: { id: targetId },
      select: {
        adSetId: true,
        adSet: {
          select: {
            campaignId: true,
            campaign: {
              select: { adAccountId: true, adAccount: { select: { currency: true } } },
            },
          },
        },
      },
    });
    adAccountId = a.adSet.campaign.adAccountId;
    campaignId = a.adSet.campaignId;
    adSetId = a.adSetId;
    adId = targetId;
    currency = a.adSet.campaign.adAccount.currency;
  } else {
    const acc = await prisma.adAccount.findUniqueOrThrow({
      where: { id: targetId },
      select: { currency: true },
    });
    currency = acc.currency;
  }

  if (currency === "LAK") fxRateToLak = 1;
  if (fxRateToLak <= 0) {
    throw new Error(`ອັດຕາແລກປ່ຽນ ${currency} ເປັນກີບຕ້ອງຫຼາຍກວ່າ 0`);
  }

  const entityKey = `${level}:${targetId}`;
  const data = {
    ...metrics,
    spendLak: Math.round(metrics.spend * fxRateToLak),
    fxRateToLak,
    currency,
    adAccountId,
    campaignId,
    adSetId,
    adId,
    level,
    source: "MANUAL" as const,
    note: str(fd, "note"),
  };

  await prisma.insight.upsert({
    where: { date_entityKey: { date, entityKey } },
    create: { date, entityKey, ...data },
    update: data,
  });

  revalidatePath("/insights");
  revalidatePath("/");
  redirect(`/insights?date=${toDateInput(date)}`);
}

export async function deleteInsight(id: string) {
  await requireSession();
  await prisma.insight.delete({ where: { id } });
  revalidatePath("/insights");
  revalidatePath("/");
}
