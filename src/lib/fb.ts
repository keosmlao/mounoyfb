import { prisma } from "./prisma";
import { chunkRange, countDays, parseDate, type DateRange } from "./date";
import { InsightLevel, SegmentKind, type EntityStatus } from "@/generated/prisma/enums";
import { SEGMENT_DEFS, buildSegKey } from "./segments";

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
  /** ດຶງຜົນແຍກກຸ່ມ (ອາຍຸ/ບ່ອນວາງ/ແຂວງ/ຊົ່ວໂມງ) — ໃຊ້ໃນໜ້າວິເຄາະ */
  segments: boolean;
};

export const DEFAULT_SYNC_LEVELS: SyncLevels = {
  campaign: true,
  adset: false,
  ad: false,
  segments: true,
};

export type SyncResult = {
  campaigns: number;
  adSets: number;
  ads: number;
  insights: number;
  segments: number;
};

/** ອ່ານ token ຈາກຖານຂໍ້ມູນກ່ອນ ຖ້າບໍ່ມີຈຶ່ງໃຊ້ຄ່າຈາກ .env */
export async function getFbConfig(): Promise<FbConfig | null> {
  const settings = await prisma.appSetting.findMany({
    where: { key: { in: ["fbAccessToken", "fbApiVersion"] } },
  });
  const map = new Map(settings.map((s) => [s.key, s.value]));

  const accessToken = map.get("fbAccessToken") || process.env.FB_ACCESS_TOKEN || "";
  const apiVersion =
    map.get("fbApiVersion") || process.env.FB_API_VERSION || "v25.0";

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

/** ເອີ້ນ Graph API ເອົາ object ດຽວ (ບໍ່ແມ່ນລາຍການ) */
async function graphOne<T>(
  config: FbConfig,
  path: string,
  params: Record<string, string>,
): Promise<T> {
  const search = new URLSearchParams({ ...params, access_token: config.accessToken });
  const res = await fetch(
    `${GRAPH}/${config.apiVersion}/${path}?${search.toString()}`,
    { cache: "no-store" },
  );
  const json = (await res.json()) as T & {
    error?: { message: string; code: number };
  };
  if (json.error) {
    throw new Error(`Facebook API: ${json.error.message} (code ${json.error.code})`);
  }
  return json;
}

// ------------------------------------------------- ທົດສອບການເຊື່ອມຕໍ່ / ນຳເຂົ້າ

export type FbAssetAccount = {
  fbAccountId: string;
  name: string;
  currency: string;
  status: EntityStatus;
  timezone: string | null;
};

export type FbAssetPage = {
  fbPageId: string;
  name: string;
  category: string | null;
};

export type FbAssets = {
  tokenOwner: string;
  accounts: FbAssetAccount[];
  pages: FbAssetPage[];
  /** ດຶງເພຈບໍ່ໄດ້ກໍ່ບໍ່ເປັນຫຍັງ — ບອກເຫດຜົນໄວ້ໃຫ້ຮູ້ */
  pagesError?: string;
};

/** ລະຫັດສະຖານະບັນຊີຂອງ Facebook → ສະຖານະໃນລະບົບເຮົາ */
function mapAccountStatus(code?: number) {
  switch (code) {
    case 1:
      return "ACTIVE" as const;
    case 100:
    case 101:
      return "ARCHIVED" as const;
    default:
      return "PAUSED" as const;
  }
}

/**
 * ທົດສອບວ່າ token ໃຊ້ໄດ້ບໍ່ ແລະ ດຶງລາຍການບັນຊີໂຄສະນາ/ເພຈ ທີ່ token ນີ້ເຂົ້າເຖິງໄດ້.
 * ໃຊ້ເພື່ອບໍ່ໃຫ້ຜູ້ໃຊ້ຕ້ອງໄປຫາ act_... ເອງ.
 */
export async function fetchFbAssets(): Promise<FbAssets> {
  const config = await getFbConfig();
  if (!config) {
    throw new Error(
      "ຍັງບໍ່ໄດ້ຕັ້ງ Facebook access token — ໃສ່ຢູ່ຊ່ອງຂ້າງເທິງແລ້ວກົດ “ບັນທຶກຄ່າ” ກ່ອນ",
    );
  }

  const me = await graphOne<{ id: string; name?: string }>(config, "me", {
    fields: "id,name",
  });

  type RawAccount = {
    id: string;
    name?: string;
    currency?: string;
    account_status?: number;
    timezone_name?: string;
  };
  const accountFields =
    "id,name,currency,account_status,timezone_name";

  // system user token ບາງກໍລະນີເຫັນສະເພາະ assigned_ad_accounts
  let raw = await graphAll<RawAccount>(config, "me/adaccounts", {
    fields: accountFields,
  });
  if (raw.length === 0) {
    try {
      raw = await graphAll<RawAccount>(config, "me/assigned_ad_accounts", {
        fields: accountFields,
      });
    } catch {
      // ບໍ່ມີ edge ນີ້ກໍ່ຂ້າມໄປ — ຖືວ່າບໍ່ມີບັນຊີ
    }
  }

  const accounts: FbAssetAccount[] = raw.map((a) => ({
    fbAccountId: a.id, // ມາເປັນຮູບແບບ act_XXXXXXXX ຢູ່ແລ້ວ
    name: a.name ?? a.id,
    currency: a.currency ?? "USD",
    status: mapAccountStatus(a.account_status),
    timezone: a.timezone_name ?? null,
  }));

  // ເພຈຕ້ອງການສິດ pages_show_list — ບໍ່ມີກໍ່ຍັງໃຊ້ລະບົບໄດ້ ຈຶ່ງບໍ່ໃຫ້ລົ້ມ
  let pages: FbAssetPage[] = [];
  let pagesError: string | undefined;
  try {
    type RawPage = { id: string; name?: string; category?: string };
    let rawPages = await graphAll<RawPage>(config, "me/accounts", {
      fields: "id,name,category",
    });
    if (rawPages.length === 0) {
      rawPages = await graphAll<RawPage>(config, "me/assigned_pages", {
        fields: "id,name,category",
      });
    }
    pages = rawPages.map((p) => ({
      fbPageId: p.id,
      name: p.name ?? p.id,
      category: p.category ?? null,
    }));
  } catch (error) {
    pagesError = error instanceof Error ? error.message : String(error);
  }

  return { tokenOwner: me.name ?? me.id, accounts, pages, pagesError };
}

/**
 * ນຳເຂົ້າບັນຊີໂຄສະນາ ແລະ ເພຈ ທີ່ດຶງມາໄດ້ ລົງຖານຂໍ້ມູນ.
 * ບັນຊີທີ່ຍັງບໍ່ມີ fbAccountId ແຕ່ຊື່ກົງກັນ ຈະຖືກຕໍ່ ID ໃສ່ໃຫ້ ແທນການສ້າງອັນຊ້ຳ.
 */
export async function importFbAssets(): Promise<{
  accounts: number;
  pages: number;
}> {
  const assets = await fetchFbAssets();
  let accountCount = 0;
  let pageCount = 0;

  for (const a of assets.accounts) {
    const existing = await prisma.adAccount.findUnique({
      where: { fbAccountId: a.fbAccountId },
    });

    if (existing) {
      await prisma.adAccount.update({
        where: { id: existing.id },
        data: { name: a.name, currency: a.currency, status: a.status },
      });
    } else {
      // ຖ້າມີບັນຊີເປົ່າທີ່ຍັງບໍ່ໄດ້ຜູກ ID ໄວ້ ໃຫ້ຜູກໃສ່ອັນນັ້ນແທນການສ້າງໃໝ່
      const unlinked = await prisma.adAccount.findFirst({
        where: { fbAccountId: null },
        orderBy: { createdAt: "asc" },
      });
      if (unlinked) {
        await prisma.adAccount.update({
          where: { id: unlinked.id },
          data: {
            fbAccountId: a.fbAccountId,
            name: a.name,
            currency: a.currency,
            status: a.status,
            timezone: a.timezone ?? unlinked.timezone,
          },
        });
      } else {
        await prisma.adAccount.create({
          data: {
            fbAccountId: a.fbAccountId,
            name: a.name,
            currency: a.currency,
            status: a.status,
            ...(a.timezone ? { timezone: a.timezone } : {}),
          },
        });
      }
    }
    accountCount++;
  }

  for (const p of assets.pages) {
    const existing = await prisma.fbPage.findUnique({
      where: { fbPageId: p.fbPageId },
    });
    if (existing) {
      await prisma.fbPage.update({
        where: { id: existing.id },
        data: { name: p.name, category: p.category },
      });
    } else {
      const unlinked = await prisma.fbPage.findFirst({
        where: { fbPageId: null },
        orderBy: { createdAt: "asc" },
      });
      if (unlinked) {
        await prisma.fbPage.update({
          where: { id: unlinked.id },
          data: { fbPageId: p.fbPageId, name: p.name, category: p.category },
        });
      } else {
        await prisma.fbPage.create({
          data: { fbPageId: p.fbPageId, name: p.name, category: p.category },
        });
      }
    }
    pageCount++;
  }

  return { accounts: accountCount, pages: pageCount };
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

/** ໂຄງສ້າງຂອງ 1 ບັນຊີທີ່ດຶງມາແລ້ວ — ໃຊ້ຊ້ຳທຸກທ່ອນອາທິດ ບໍ່ຕ້ອງດຶງໃໝ່ */
type AccountContext = {
  account: { id: string; currency: string; fbAccountId: string };
  campaignByFbId: Map<string, string>;
  adSetByFbId: Map<string, string>;
  adByFbId: Map<string, { id: string; adSetId: string }>;
  fxCache: Map<string, number>;
};

/**
 * ດຶງ/ອັບເດດໂຄງສ້າງ (campaign → ad set → ad) ຂອງ 1 ບັນຊີ.
 * ເຮັດເທື່ອດຽວຕໍ່ການ sync 1 ຮອບ ເພາະໂຄງສ້າງບໍ່ຂຶ້ນກັບຊ່ວງວັນ.
 */
async function syncAccountStructure(
  config: FbConfig,
  account: { id: string; currency: string; fbAccountId: string | null },
  levels: SyncLevels,
  result: SyncResult,
): Promise<AccountContext> {
  const actId = account.fbAccountId as string;
  const needsStructureBelowCampaign = levels.adset || levels.ad;

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

  return {
    account: { id: account.id, currency: account.currency, fbAccountId: actId },
    campaignByFbId,
    adSetByFbId,
    adByFbId,
    fxCache: new Map(),
  };
}

/** ດຶງຜົນລາຍວັນ 1 ລະດັບ ຂອງ 1 ບັນຊີ ໃນຊ່ວງວັນທີ່ກຳນົດ */
async function pullInsights(
  config: FbConfig,
  ctx: AccountContext,
  range: DateRange,
  level: InsightLevel,
  defaultFx: number,
  result: SyncResult,
) {
  const { account, campaignByFbId, adSetByFbId, adByFbId, fxCache } = ctx;
  const fbLevel =
    level === "CAMPAIGN" ? "campaign" : level === "ADSET" ? "adset" : "ad";

  const rows = await graphAll<FbInsight>(
    config,
    `${account.fbAccountId}/insights`,
    {
      level: fbLevel,
      time_increment: "1",
      time_range: JSON.stringify({ since: range.from, until: range.to }),
      fields:
        "date_start,campaign_id,adset_id,ad_id,spend,impressions,reach,clicks,inline_link_clicks,actions,action_values",
    },
  );

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
      revenue: Math.round(actionValue(row.action_values, PURCHASE_ACTIONS) * rate),
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
}

/**
 * ດຶງຜົນແຍກກຸ່ມ 1 ມິຕິ ຂອງ 1 ບັນຊີ ໃນຊ່ວງວັນທີ່ກຳນົດ.
 * ເກັບລົງຕາຕະລາງ SegmentInsight ຕ່າງຫາກ ຈຶ່ງບໍ່ກະທົບຍອດລວມຂອງລະບົບ.
 */
async function pullSegments(
  config: FbConfig,
  ctx: AccountContext,
  range: DateRange,
  defaultFx: number,
  result: SyncResult,
) {
  const { account, campaignByFbId, fxCache } = ctx;

  for (const def of SEGMENT_DEFS) {
    const rows = await graphAll<FbInsight & Record<string, unknown>>(
      config,
      `${account.fbAccountId}/insights`,
      {
        level: "campaign",
        time_increment: "1",
        breakdowns: def.breakdowns,
        time_range: JSON.stringify({ since: range.from, until: range.to }),
        fields:
          "date_start,campaign_id,spend,impressions,reach,clicks,inline_link_clicks,actions,action_values",
      },
    );

    for (const row of rows) {
      const campaignId = row.campaign_id
        ? (campaignByFbId.get(row.campaign_id) ?? null)
        : null;
      if (!campaignId) continue;

      const segKey = buildSegKey(def, row);
      if (!segKey) continue;

      const date = parseDate(row.date_start);
      const fxKey = `${row.date_start}:${account.currency}`;
      let rate = fxCache.get(fxKey);
      if (rate === undefined) {
        rate = await fxRateFor(date, account.currency, defaultFx);
        fxCache.set(fxKey, rate);
      }

      const spend = Number(row.spend) || 0;
      const data = {
        adAccountId: account.id,
        campaignId,
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
      };

      await prisma.segmentInsight.upsert({
        where: {
          date_kind_segKey_campaignId: {
            date,
            kind: def.kind as SegmentKind,
            segKey,
            campaignId,
          },
        },
        create: { date, kind: def.kind as SegmentKind, segKey, ...data },
        update: data,
      });
      result.segments++;
    }
  }
}

/** ຄວາມຄືບໜ້າທີ່ລາຍງານກັບຫຼັງແຕ່ລະທ່ອນອາທິດ */
export type SyncProgress = {
  doneDays: number;
  totalDays: number;
  result: SyncResult;
};

/**
 * ດຶງໂຄງສ້າງ ແລະ ຜົນລາຍວັນຂອງທຸກບັນຊີໂຄສະນາທີ່ໃສ່ fbAccountId ໄວ້.
 * ດຶງລະດັບໃດແດ່ ຂຶ້ນກັບ `levels` — ແຄມເປນຖືກດຶງສະເໝີ ເພາະເປັນແມ່ຂອງລະດັບອື່ນ.
 *
 * ຜົນລາຍວັນຖືກແບ່ງດຶງ **ເທື່ອລະອາທິດ** ເພື່ອບໍ່ໃຫ້ຮ້ອງ API ເທື່ອດຽວຍາວຈົນ timeout
 * ແລະ ເພື່ອລາຍງານຄວາມຄືບໜ້າຜ່ານ `onProgress` ໄດ້ລະຫວ່າງທາງ.
 */
export async function syncFromFacebook(
  range: DateRange,
  levels: SyncLevels = DEFAULT_SYNC_LEVELS,
  onProgress?: (progress: SyncProgress) => Promise<void> | void,
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

  const result: SyncResult = { campaigns: 0, adSets: 0, ads: 0, insights: 0, segments: 0 };

  // 1) ໂຄງສ້າງ — ດຶງເທື່ອດຽວຕໍ່ບັນຊີ ເພາະບໍ່ຂຶ້ນກັບຊ່ວງວັນ
  const contexts: AccountContext[] = [];
  for (const account of accounts) {
    contexts.push(await syncAccountStructure(config, account, levels, result));
  }

  // 2) ຜົນລາຍວັນ — ວົນເທື່ອລະອາທິດ ແລ້ວລາຍງານຄວາມຄືບໜ້າ
  const chunks = chunkRange(range, 7);
  const totalDays = countDays(range);
  let doneDays = 0;

  for (const chunk of chunks) {
    for (const ctx of contexts) {
      // ລະດັບແຄມເປນດຶງສະເໝີ ເພາະຍອດລວມທັງລະບົບນັບຈາກແຖວລະດັບນີ້ (ເບິ່ງ lib/scope.ts)
      await pullInsights(config, ctx, chunk, InsightLevel.CAMPAIGN, defaultFx, result);
      if (levels.adset) {
        await pullInsights(config, ctx, chunk, InsightLevel.ADSET, defaultFx, result);
      }
      if (levels.ad) {
        await pullInsights(config, ctx, chunk, InsightLevel.AD, defaultFx, result);
      }
      if (levels.segments) {
        await pullSegments(config, ctx, chunk, defaultFx, result);
      }
    }

    doneDays += countDays(chunk);
    await onProgress?.({ doneDays, totalDays, result });
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

/**
 * ວຽກ sync ທີ່ຄ້າງດົນກວ່ານີ້ຖືວ່າຕາຍໄປແລ້ວ (ເຊັ່ນ ເຊີບເວີ restart ກາງຄັນ)
 * ເພາະວຽກອັບເດດຄວາມຄືບໜ້າທຸກໆອາທິດທີ່ດຶງຈົບ
 */
const STALE_AFTER_MS = 15 * 60 * 1000;

/** ປິດວຽກທີ່ຄ້າງໄວ້ໃຫ້ເປັນ "ຜິດພາດ" — ບໍ່ດັ່ງນັ້ນຈະ sync ໃໝ່ບໍ່ໄດ້ຕະຫຼອດ */
async function closeStaleRuns() {
  await prisma.syncLog.updateMany({
    where: {
      status: "RUNNING",
      updatedAt: { lt: new Date(Date.now() - STALE_AFTER_MS) },
    },
    data: {
      status: "FAILED",
      finishedAt: new Date(),
      message: "ຂາດການຕິດຕໍ່ກາງຄັນ (ເຊີບເວີອາດ restart) — ກົດດຶງໃໝ່ໄດ້",
    },
  });
}

/** ວຽກ sync ທີ່ກຳລັງແລ່ນຢູ່ດຽວນີ້ (null = ບໍ່ມີ) */
export async function activeSyncLog() {
  await closeStaleRuns();
  return prisma.syncLog.findFirst({
    where: { status: "RUNNING" },
    orderBy: { startedAt: "desc" },
  });
}

/**
 * ສ້າງແຖວ log ແລ້ວຄືນທັນທີ — ຍັງບໍ່ທັນດຶງຂໍ້ມູນ.
 * ຮັບປະກັນວ່າມີວຽກແລ່ນຢູ່ໄດ້ເທື່ອລະອັນ ເພື່ອບໍ່ໃຫ້ 2 ວຽກຂຽນທັບກັນ.
 */
export async function startSyncLog(range: DateRange, levels: SyncLevels) {
  const running = await activeSyncLog();
  if (running) {
    throw new Error("ມີການດຶງຂໍ້ມູນແລ່ນຢູ່ແລ້ວ — ລໍໃຫ້ຮອບນີ້ຈົບກ່ອນ");
  }

  const chosen = (["campaign", "adset", "ad"] as const).filter((k) => levels[k]);

  try {
    return await prisma.syncLog.create({
      data: {
        status: "RUNNING",
        level: chosen.join(", ") || "campaign",
        dateFrom: parseDate(range.from),
        dateTo: parseDate(range.to),
        totalDays: countDays(range),
        message: "ກຳລັງດຶງໂຄງສ້າງແຄມເປນ...",
      },
    });
  } catch (error) {
    // Database unique index is the final guard against two concurrent requests.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      throw new Error("ມີການດຶງຂໍ້ມູນແລ່ນຢູ່ແລ້ວ — ລໍໃຫ້ຮອບນີ້ຈົບກ່ອນ");
    }
    throw error;
  }
}

/**
 * ແລ່ນການ sync ຈິງ — ຖືກເອີ້ນ **ເບື້ອງຫຼັງ** ຫຼັງຈາກຕອບ request ໄປແລ້ວ
 * ຈຶ່ງບໍ່ throw ອອກມາ ແຕ່ບັນທຶກຜົນລົງ SyncLog ໃຫ້ໜ້າຈໍໄປອ່ານແທນ.
 */
export async function runSyncJob(
  logId: string,
  range: DateRange,
  levels: SyncLevels,
) {
  // Touch updatedAt while a long API request/structure import is still active.
  // This prevents the UI's stale-job cleanup from closing a healthy job.
  const heartbeat = setInterval(() => {
    void prisma.syncLog
      .updateMany({
        where: { id: logId, status: "RUNNING" },
        data: { updatedAt: new Date() },
      })
      .catch(() => undefined);
  }, 60_000);
  heartbeat.unref();

  try {
    const result = await syncFromFacebook(range, levels, async (progress) => {
      await prisma.syncLog.update({
        where: { id: logId },
        data: {
          doneDays: progress.doneDays,
          recordCount: progress.result.insights,
          message: `ດຶງແລ້ວ ${progress.doneDays}/${progress.totalDays} ວັນ`,
        },
      });
    });

    await prisma.syncLog.update({
      where: { id: logId },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        recordCount: result.insights,
        doneDays: countDays(range),
        message:
          `ແຄມເປນ ${result.campaigns} · ຊຸດ ${result.adSets} · ໂຄສະນາ ${result.ads} · ` +
          `ຜົນລາຍວັນ ${result.insights} ແຖວ · ແຍກກຸ່ມ ${result.segments} ແຖວ ` +
          `(${range.from} — ${range.to})`,
      },
    });
    return result;
  } catch (error) {
    await prisma.syncLog.update({
      where: { id: logId },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        message: error instanceof Error ? error.message : String(error),
      },
    });
    return null;
  } finally {
    clearInterval(heartbeat);
  }
}
