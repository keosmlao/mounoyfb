import { prisma } from "./prisma";
import { parseDate, type DateRange } from "./date";
import { InsightLevel } from "@/generated/prisma/enums";

/**
 * ຕົວເຊື່ອມກັບ Facebook Marketing API.
 *
 * ລະບົບໃຊ້ງານໄດ້ເຕັມທີ່ໂດຍບໍ່ຕ້ອງມີສ່ວນນີ້ (ປ້ອນມືໄດ້ໝົດ).
 * ເມື່ອໃສ່ access token ແລ້ວ ຈຶ່ງຈະດຶງໂຄງສ້າງ (campaign / ad set / ad) ແລະ
 * ຜົນລາຍວັນມາ upsert ທັບ ໂດຍໃຊ້ fb*Id ເປັນຕົວອ້າງອີງ — ແຖວທີ່ປ້ອນມືໄວ້ຈະບໍ່ຖືກ
 * ລົບກວນ ນອກຈາກວັນ/ອົງປະກອບດຽວກັນ ຊຶ່ງຈະຖືກທັບດ້ວຍຕົວເລກຈິງຈາກ Facebook.
 */

const GRAPH = "https://graph.facebook.com";

export type FbConfig = {
  accessToken: string;
  apiVersion: string;
};

/** ລະດັບທີ່ຈະດຶງ — ດຶງລະດັບຍ່ອຍໄດ້ ແຕ່ຈະຊ້າ ແລະ ກິນ rate limit ຫຼາຍກວ່າ */
export type SyncLevels = {
  campaign: boolean;
  adset: boolean;
  ad: boolean;
};

export const DEFAULT_SYNC_LEVELS: SyncLevels = {
  campaign: true,
  adset: false,
  ad: false,
};

export type SyncResult = {
  campaigns: number;
  adSets: number;
  ads: number;
  insights: number;
};

/** ອ່ານ token ຈາກຖານຂໍ້ມູນກ່ອນ ຖ້າບໍ່ມີຈຶ່ງໃຊ້ຄ່າຈາກ .env */
export async function getFbConfig(): Promise<FbConfig | null> {
  const settings = await prisma.appSetting.findMany({
    where: { key: { in: ["fbAccessToken", "fbApiVersion"] } },
  });
  const map = new Map(settings.map((s) => [s.key, s.value]));

  const accessToken = map.get("fbAccessToken") || process.env.FB_ACCESS_TOKEN || "";
  const apiVersion =
    map.get("fbApiVersion") || process.env.FB_API_VERSION || "v21.0";

  return accessToken ? { accessToken, apiVersion } : null;
}

type GraphResponse<T> = {
  data?: T[];
  paging?: { next?: string };
  error?: { message: string; type: string; code: number };
};

/** ເອີ້ນ Graph API ພ້ອມໄລ່ໜ້າ (paging) ໃຫ້ຄົບ */
async function graphAll<T>(
  config: FbConfig,
  path: string,
  params: Record<string, string>,
): Promise<T[]> {
  const search = new URLSearchParams({
    ...params,
    access_token: config.accessToken,
    limit: "200",
  });
  let url = `${GRAPH}/${config.apiVersion}/${path}?${search.toString()}`;
  const out: T[] = [];

  // ຈຳກັດຈຳນວນໜ້າ ເພື່ອກັນ loop ບໍ່ຮູ້ຈົບ ຖ້າ API ຄືນ paging ຜິດປົກກະຕິ
  for (let page = 0; page < 50; page++) {
    const res = await fetch(url, { cache: "no-store" });
    const json = (await res.json()) as GraphResponse<T>;

    if (json.error) {
      throw new Error(`Facebook API: ${json.error.message} (code ${json.error.code})`);
    }
    if (json.data) out.push(...json.data);
    if (!json.paging?.next) break;
    url = json.paging.next;
  }

  return out;
}

// --------------------------------------------------------------------- types

type FbCampaign = {
  id: string;
  name: string;
  objective?: string;
  status?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
};

type FbAdSet = {
  id: string;
  name: string;
  campaign_id: string;
  status?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  bid_amount?: string;
  optimization_goal?: string;
  billing_event?: string;
  start_time?: string;
  end_time?: string;
  targeting?: unknown;
};

type FbAd = {
  id: string;
  name: string;
  adset_id: string;
  status?: string;
  creative?: {
    thumbnail_url?: string;
    title?: string;
    body?: string;
    object_type?: string;
  };
};

type FbAction = { action_type: string; value: string };

type FbInsight = {
  date_start: string;
  campaign_id?: string;
  adset_id?: string;
  ad_id?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  inline_link_clicks?: string;
  actions?: FbAction[];
  action_values?: FbAction[];
};

// ------------------------------------------------------------------ mapping

/** ແປງ objective ຂອງ Facebook ມາເປັນຄ່າໃນລະບົບເຮົາ */
function mapObjective(value?: string) {
  const v = (value ?? "").toUpperCase();
  if (v.includes("MESSAG")) return "MESSAGES" as const;
  if (v.includes("LEAD")) return "LEADS" as const;
  if (v.includes("SALES") || v.includes("CONVERSION")) return "SALES" as const;
  if (v.includes("TRAFFIC") || v.includes("LINK_CLICKS")) return "TRAFFIC" as const;
  if (v.includes("VIDEO")) return "VIDEO_VIEWS" as const;
  if (v.includes("AWARENESS") || v.includes("REACH")) return "AWARENESS" as const;
  if (v.includes("APP")) return "APP_PROMOTION" as const;
  return "ENGAGEMENT" as const;
}

function mapStatus(value?: string) {
  switch ((value ?? "").toUpperCase()) {
    case "ACTIVE":
      return "ACTIVE" as const;
    case "PAUSED":
      return "PAUSED" as const;
    case "ARCHIVED":
    case "DELETED":
      return "ARCHIVED" as const;
    default:
      return "DRAFT" as const;
  }
}

/** ງົບຈາກ API ມາເປັນຫົວໜ່ວຍນ້ອຍສຸດ (ເຊັນ) ຈຶ່ງຫານ 100 */
function money(value?: string): number | null {
  return value ? Number(value) / 100 : null;
}

/** "2026-07-26T10:00:00+0700" → Date ຂອງວັນນັ້ນ (UTC midnight) ສຳລັບຄໍລຳ @db.Date */
function dateOnly(value?: string): Date | null {
  return value ? parseDate(value.slice(0, 10)) : null;
}

function actionValue(actions: FbAction[] | undefined, types: string[]): number {
  if (!actions) return 0;
  let sum = 0;
  for (const a of actions) {
    if (types.includes(a.action_type)) sum += Number(a.value) || 0;
  }
  return sum;
}

const MESSAGE_ACTIONS = [
  "onsite_conversion.messaging_conversation_started_7d",
  "onsite_conversion.total_messaging_connection",
];
const LEAD_ACTIONS = ["lead", "onsite_conversion.lead_grouped"];
const PURCHASE_ACTIONS = [
  "purchase",
  "omni_purchase",
  "offsite_conversion.fb_pixel_purchase",
];
const VIDEO_ACTIONS = ["video_view", "watch_video_view"];

// --------------------------------------------------------------------- sync

/**
 * ດຶງໂຄງສ້າງ ແລະ ຜົນລາຍວັນຂອງທຸກບັນຊີໂຄສະນາທີ່ໃສ່ fbAccountId ໄວ້.
 * ດຶງລະດັບໃດແດ່ ຂຶ້ນກັບ `levels` — ແຄມເປນຖືກດຶງສະເໝີ ເພາະເປັນແມ່ຂອງລະດັບອື່ນ.
 */
export async function syncFromFacebook(
  range: DateRange,
  levels: SyncLevels = DEFAULT_SYNC_LEVELS,
): Promise<SyncResult> {
  const config = await getFbConfig();
  if (!config) {
    throw new Error(
      "ຍັງບໍ່ໄດ້ຕັ້ງ Facebook access token — ໃສ່ໄດ້ຢູ່ໜ້າ ຕັ້ງຄ່າ ຫຼື ໃນ .env",
    );
  }

  const accounts = await prisma.adAccount.findMany({
    where: { fbAccountId: { not: null } },
  });
  if (accounts.length === 0) {
    throw new Error("ບໍ່ມີບັນຊີໂຄສະນາທີ່ໃສ່ Facebook Ad Account ID (act_...) ໄວ້");
  }

  const fxSetting = await prisma.appSetting.findUnique({
    where: { key: "defaultFxRateToLak" },
  });
  const defaultFx = Number(fxSetting?.value) || 21700;

  const result: SyncResult = { campaigns: 0, adSets: 0, ads: 0, insights: 0 };
  const needsStructureBelowCampaign = levels.adset || levels.ad;

  for (const account of accounts) {
    const actId = account.fbAccountId as string;

    // 1) ແຄມເປນ — ດຶງສະເໝີ ເພາະ ad set / ad ຕ້ອງອ້າງອີງ
    const fbCampaigns = await graphAll<FbCampaign>(config, `${actId}/campaigns`, {
      fields:
        "id,name,objective,status,daily_budget,lifetime_budget,start_time,stop_time",
    });

    for (const c of fbCampaigns) {
      const data = {
        name: c.name,
        objective: mapObjective(c.objective),
        status: mapStatus(c.status),
        dailyBudget: money(c.daily_budget),
        lifetimeBudget: money(c.lifetime_budget),
        startDate: dateOnly(c.start_time),
        endDate: dateOnly(c.stop_time),
      };
      await prisma.campaign.upsert({
        where: { fbCampaignId: c.id },
        create: { fbCampaignId: c.id, adAccountId: account.id, ...data },
        update: data,
      });
      result.campaigns++;
    }

    const campaignByFbId = new Map(
      (
        await prisma.campaign.findMany({
          where: { adAccountId: account.id, fbCampaignId: { not: null } },
          select: { id: true, fbCampaignId: true },
        })
      ).map((c) => [c.fbCampaignId as string, c.id]),
    );

    // 2) ຊຸດໂຄສະນາ
    if (needsStructureBelowCampaign) {
      const fbAdSets = await graphAll<FbAdSet>(config, `${actId}/adsets`, {
        fields:
          "id,name,campaign_id,status,daily_budget,lifetime_budget,bid_amount,optimization_goal,billing_event,start_time,end_time,targeting",
      });

      for (const s of fbAdSets) {
        const campaignId = campaignByFbId.get(s.campaign_id);
        if (!campaignId) continue; // ແຄມເປນແມ່ບໍ່ຢູ່ໃນບັນຊີນີ້ — ຂ້າມ

        const data = {
          name: s.name,
          status: mapStatus(s.status),
          dailyBudget: money(s.daily_budget),
          lifetimeBudget: money(s.lifetime_budget),
          bidAmount: money(s.bid_amount),
          optimizationGoal: s.optimization_goal ?? null,
          billingEvent: s.billing_event ?? null,
          audience: summarizeTargeting(s.targeting),
          startDate: dateOnly(s.start_time),
          endDate: dateOnly(s.end_time),
        };
        await prisma.adSet.upsert({
          where: { fbAdSetId: s.id },
          create: { fbAdSetId: s.id, campaignId, ...data },
          update: { ...data, campaignId },
        });
        result.adSets++;
      }
    }

    const adSetByFbId = new Map(
      (
        await prisma.adSet.findMany({
          where: {
            fbAdSetId: { not: null },
            campaign: { adAccountId: account.id },
          },
          select: { id: true, fbAdSetId: true },
        })
      ).map((s) => [s.fbAdSetId as string, s.id]),
    );

    // 3) ຊິ້ນໂຄສະນາ
    if (levels.ad) {
      const fbAds = await graphAll<FbAd>(config, `${actId}/ads`, {
        fields:
          "id,name,adset_id,status,creative{thumbnail_url,title,body,object_type}",
      });

      for (const a of fbAds) {
        const adSetId = adSetByFbId.get(a.adset_id);
        if (!adSetId) continue;

        const data = {
          name: a.name,
          status: mapStatus(a.status),
          creativeType: a.creative?.object_type ?? null,
          creativeUrl: a.creative?.thumbnail_url ?? null,
          headline: a.creative?.title ?? null,
          primaryText: a.creative?.body ?? null,
        };
        await prisma.ad.upsert({
          where: { fbAdId: a.id },
          create: { fbAdId: a.id, adSetId, ...data },
          update: { ...data, adSetId },
        });
        result.ads++;
      }
    }

    const adByFbId = new Map(
      (
        await prisma.ad.findMany({
          where: {
            fbAdId: { not: null },
            adSet: { campaign: { adAccountId: account.id } },
          },
          select: { id: true, fbAdId: true, adSetId: true },
        })
      ).map((a) => [a.fbAdId as string, a]),
    );

    // 4) ຜົນລາຍວັນ ຂອງແຕ່ລະລະດັບທີ່ເລືອກ
    const fxCache = new Map<string, number>();

    const pullInsights = async (level: InsightLevel) => {
      const fbLevel =
        level === "CAMPAIGN" ? "campaign" : level === "ADSET" ? "adset" : "ad";

      const rows = await graphAll<FbInsight>(config, `${actId}/insights`, {
        level: fbLevel,
        time_increment: "1",
        time_range: JSON.stringify({ since: range.from, until: range.to }),
        fields:
          "date_start,campaign_id,adset_id,ad_id,spend,impressions,reach,clicks,inline_link_clicks,actions,action_values",
      });

      for (const row of rows) {
        // ຫາ id ພາຍໃນລະບົບຂອງອົງປະກອບທີ່ແຖວນີ້ເວົ້າເຖິງ
        let campaignId = row.campaign_id
          ? (campaignByFbId.get(row.campaign_id) ?? null)
          : null;
        let adSetId: string | null = null;
        let adId: string | null = null;

        if (level === "ADSET") {
          adSetId = row.adset_id ? (adSetByFbId.get(row.adset_id) ?? null) : null;
          if (!adSetId) continue;
        } else if (level === "AD") {
          const ad = row.ad_id ? adByFbId.get(row.ad_id) : undefined;
          if (!ad) continue;
          adId = ad.id;
          adSetId = ad.adSetId;
        } else if (!campaignId) {
          continue;
        }

        // ຖ້າ Facebook ບໍ່ສົ່ງ campaign_id ມາ ໃຫ້ຖອຍໄປຫາຈາກ ad set
        if (!campaignId && adSetId) {
          const parent = await prisma.adSet.findUnique({
            where: { id: adSetId },
            select: { campaignId: true },
          });
          campaignId = parent?.campaignId ?? null;
        }

        const targetId =
          level === "AD" ? adId : level === "ADSET" ? adSetId : campaignId;
        if (!targetId) continue;

        const date = parseDate(row.date_start);
        const fxKey = `${row.date_start}:${account.currency}`;
        let rate = fxCache.get(fxKey);
        if (rate === undefined) {
          rate = await fxRateFor(date, account.currency, defaultFx);
          fxCache.set(fxKey, rate);
        }

        const spend = Number(row.spend) || 0;
        const entityKey = `${level}:${targetId}`;
        const data = {
          adAccountId: account.id,
          campaignId,
          adSetId,
          adId,
          level,
          currency: account.currency,
          fxRateToLak: rate,
          spend,
          spendLak: Math.round(spend * rate),
          impressions: Number(row.impressions) || 0,
          reach: Number(row.reach) || 0,
          clicks: Number(row.clicks) || 0,
          linkClicks: Number(row.inline_link_clicks) || 0,
          messages: actionValue(row.actions, MESSAGE_ACTIONS),
          leadsCount: actionValue(row.actions, LEAD_ACTIONS),
          purchases: actionValue(row.actions, PURCHASE_ACTIONS),
          revenue: Math.round(
            actionValue(row.action_values, PURCHASE_ACTIONS) * rate,
          ),
          videoViews: actionValue(row.actions, VIDEO_ACTIONS),
          source: "API" as const,
        };

        await prisma.insight.upsert({
          where: { date_entityKey: { date, entityKey } },
          create: { date, entityKey, ...data },
          update: data,
        });
        result.insights++;
      }
    };

    // ລະດັບແຄມເປນດຶງສະເໝີ ເພາະຍອດລວມທັງລະບົບນັບຈາກແຖວລະດັບນີ້ (ເບິ່ງ lib/scope.ts)
    await pullInsights(InsightLevel.CAMPAIGN);
    if (levels.adset) await pullInsights(InsightLevel.ADSET);
    if (levels.ad) await pullInsights(InsightLevel.AD);
  }

  return result;
}

/** ຫຍໍ້ targeting ຂອງ Facebook ໃຫ້ເປັນຂໍ້ຄວາມສັ້ນໆ ພໍໃຫ້ຄົນອ່ານເຂົ້າໃຈ */
function summarizeTargeting(targeting: unknown): string | null {
  if (!targeting || typeof targeting !== "object") return null;
  const t = targeting as Record<string, unknown>;
  const parts: string[] = [];

  const ageMin = t.age_min;
  const ageMax = t.age_max;
  if (ageMin || ageMax) parts.push(`ອາຍຸ ${ageMin ?? "?"}-${ageMax ?? "?"}`);

  const genders = t.genders;
  if (Array.isArray(genders) && genders.length === 1) {
    parts.push(genders[0] === 1 ? "ຊາຍ" : "ຍິງ");
  }

  const geo = t.geo_locations as Record<string, unknown> | undefined;
  const countries = geo?.countries;
  if (Array.isArray(countries) && countries.length) {
    parts.push(countries.join(", "));
  }
  const cities = geo?.cities;
  if (Array.isArray(cities) && cities.length) {
    parts.push(`${cities.length} ເມືອງ`);
  }

  const interests = (t.flexible_spec ?? t.interests) as unknown;
  if (Array.isArray(interests) && interests.length) {
    parts.push(`ຄວາມສົນໃຈ ${interests.length} ກຸ່ມ`);
  }

  return parts.length ? parts.join(" · ") : null;
}

/** ອັດຕາແລກປ່ຽນຂອງວັນນັ້ນ — ບໍ່ມີກໍ່ໃຊ້ຄ່າ default */
async function fxRateFor(
  date: Date,
  currency: string,
  fallback: number,
): Promise<number> {
  if (currency === "LAK") return 1;
  const rate = await prisma.exchangeRate.findUnique({
    where: { date_currency: { date, currency } },
  });
  return rate?.rateToLak ?? fallback;
}

/** ຫໍ່ການ sync ໄວ້ພ້ອມບັນທຶກ log ເພື່ອໃຫ້ຕິດຕາມໄດ້ວ່າແລ່ນເມື່ອໃດ ສຳເລັດບໍ່ */
export async function runSyncWithLog(range: DateRange, levels: SyncLevels) {
  const chosen = (["campaign", "adset", "ad"] as const).filter((k) => levels[k]);

  const log = await prisma.syncLog.create({
    data: {
      status: "RUNNING",
      level: chosen.join(", ") || "campaign",
      dateFrom: parseDate(range.from),
      dateTo: parseDate(range.to),
    },
  });

  try {
    const result = await syncFromFacebook(range, levels);
    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        recordCount: result.insights,
        message:
          `ແຄມເປນ ${result.campaigns} · ຊຸດ ${result.adSets} · ໂຄສະນາ ${result.ads} · ` +
          `ຜົນລາຍວັນ ${result.insights} ແຖວ (${range.from} — ${range.to})`,
      },
    });
    return result;
  } catch (error) {
    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        message: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}
