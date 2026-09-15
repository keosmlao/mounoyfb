import { prisma } from "./prisma";
import {
  explainFbError,
  getFbConfig,
  graphErrorOf,
  graphFetch,
  type FbConfig,
} from "./fb";
import { DEFAULT_FX_RATE, toMinorUnits } from "./money";
import {
  boostName,
  buildTargeting,
  budgetInLak,
  storyId,
  validateBoost,
  type BoostInput,
} from "./live-boost";

/**
 * ສ້າງ ແລະ ຄຸມການ boost live ຢູ່ Facebook — **ໃຊ້ເງິນຈິງ**.
 *
 * ກົດເຫຼັກ:
 * 1. ສ້າງທຸກຊັ້ນໃນສະຖານະ **PAUSED** — ເງິນເລີ່ມຕັດກໍ່ຕໍ່ເມື່ອຄົນກົດ "ຍິງ"
 * 2. ງົບຕ້ອງຜ່ານເພດານ (ກີບ) ທີ່ຜູ້ດູແລຕັ້ງໄວ້ — ບໍ່ໄດ້ຕັ້ງ = boost ບໍ່ໄດ້
 * 3. ສ້າງກາງທາງລົ້ມ → ລຶບແຄມເປນທີ່ສ້າງໄປແລ້ວຖິ້ມ ບໍ່ປະຂອງຄ້າງໄວ້ໃນ Ads Manager
 * 4. ງົບເປັນ lifetime + end_time — ໝົດເວລາ Facebook ຢຸດເອງ ເຖິງຄົນລືມກົດຢຸດ
 *
 * ການຮ້ອງຝັ່ງໂຄສະນາໃຊ້ token ຫຼັກ (ຕ້ອງມີ `ads_management`) ສ່ວນການຫາໂພສ
 * ຂອງວິດີໂອໃຊ້ page token.
 */

const GRAPH = "https://graph.facebook.com";

/** ເພດານງົບຕໍ່ການ boost 1 ເທື່ອ (ກີບ) — ຕັ້ງໂດຍ ADMIN */
export const BOOST_CAP_KEY = "liveBoostMaxLak";

export async function readBoostCap(): Promise<number | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: BOOST_CAP_KEY } });
  const value = Number(row?.value);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** ອັດຕາຫຼ້າສຸດຂອງສະກຸນນັ້ນ → ກີບ (ບໍ່ມີ = ຄ່າຕັ້ງ default) */
async function latestRate(currency: string): Promise<number> {
  if (currency.toUpperCase() === "LAK") return 1;
  const [row, setting] = await Promise.all([
    prisma.exchangeRate.findFirst({ where: { currency }, orderBy: { date: "desc" } }),
    prisma.appSetting.findUnique({ where: { key: "defaultFxRateToLak" } }),
  ]);
  return row?.rateToLak ?? (Number(setting?.value) || DEFAULT_FX_RATE);
}

async function post<T>(config: FbConfig, path: string, body: Record<string, string>, token = config.accessToken) {
  const json = await graphFetch<T>(`${GRAPH}/${config.apiVersion}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...body, access_token: token }).toString(),
  });
  if (json.error) throw graphErrorOf(json.error);
  return json;
}

/**
 * POST ເທື່ອດຽວ **ບໍ່ລອງໃໝ່** — ສຳລັບການ*ສ້າງ* ແຄມເປນ/ຊຸດ/ໂຄສະນາ.
 * `graphFetch` ລອງໃໝ່ເມື່ອ Facebook ຕອບຜິດພາດຊົ່ວຄາວ ແຕ່ການສ້າງບໍ່ແມ່ນ
 * "ສັ່ງຊ້ຳໄດ້ຜົນເທົ່າເກົ່າ" — ບາງເທື່ອ Facebook ສ້າງໄປແລ້ວແຕ່ຕອບຜິດພາດ
 * ລອງໃໝ່ = ແຄມເປນຊ້ຳ. ການປ່ຽນສະຖານະ (ຍິງ/ຢຸດ) ສັ່ງຊ້ຳໄດ້ ຈຶ່ງໃຊ້ `post` ຕາມປົກກະຕິ.
 */
async function createOnce<T>(config: FbConfig, path: string, body: Record<string, string>) {
  const res = await fetch(`${GRAPH}/${config.apiVersion}/${path}`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...body, access_token: config.accessToken }).toString(),
    signal: AbortSignal.timeout(30_000),
  });
  const json = (await res.json()) as T & { error?: Parameters<typeof graphErrorOf>[0] };
  if (json.error) throw graphErrorOf(json.error);
  return json;
}

async function get<T>(config: FbConfig, path: string, params: Record<string, string>, token = config.accessToken) {
  const search = new URLSearchParams({ ...params, access_token: token });
  const json = await graphFetch<T>(`${GRAPH}/${config.apiVersion}/${path}?${search.toString()}`);
  if (json.error) throw graphErrorOf(json.error);
  return json;
}

/**
 * ຫາໂພສຂອງວິດີໂອ live — ໂຄສະນາຕ້ອງອ້າງໂພສ (object_story_id) ບໍ່ແມ່ນ id ວິດີໂອ.
 * ລອງຖາມຈາກວິດີໂອກ່ອນ ຖ້າບໍ່ໄດ້ຈຶ່ງໄລ່ຫາໃນໂພສຫຼ້າສຸດຂອງເພຈ.
 */
async function findVideoStory(
  config: FbConfig,
  page: { fbPageId: string; token: string },
  videoId: string,
): Promise<string> {
  try {
    const video = await get<{ post_id?: string }>(config, videoId, { fields: "post_id" }, page.token);
    if (video.post_id) return storyId(page.fbPageId, video.post_id);
  } catch {
    // ບາງເວີຊັນບໍ່ມີຊ່ອງນີ້ — ໄປທາງສຳຮອງ
  }

  type RawPost = { id: string; attachments?: { data?: { target?: { id?: string } }[] } };
  const posts = await get<{ data?: RawPost[] }>(
    config,
    `${page.fbPageId}/posts`,
    { fields: "id,attachments{target{id}}", limit: "25" },
    page.token,
  );
  const match = posts.data?.find((p) => p.attachments?.data?.some((a) => a.target?.id === videoId));
  if (match) return storyId(page.fbPageId, match.id);

  throw new Error("ຫາໂພສຂອງວິດີໂອ live ນີ້ບໍ່ພົບ — ລໍໃຫ້ live ຂຶ້ນໜ້າເພຈກ່ອນ ແລ້ວລອງໃໝ່");
}

export type BoostRequest = Omit<BoostInput, "currency"> & { adAccountId: string };

/**
 * ສ້າງການ boost (ຢຸດໄວ້). ຄືນ id ຂອງ LiveBoost ຫຼື throw ພ້ອມເຫດຜົນເປັນພາສາລາວ.
 */
export async function createLiveBoost(
  sessionId: string,
  request: BoostRequest,
  createdBy: string | null,
): Promise<string> {
  const [session, account, config, cap] = await Promise.all([
    prisma.liveSession.findUnique({
      where: { id: sessionId },
      include: { page: { select: { fbPageId: true, token: true } } },
    }),
    prisma.adAccount.findUnique({ where: { id: request.adAccountId } }),
    getFbConfig(),
    readBoostCap(),
  ]);
  if (!session) throw new Error("ບໍ່ພົບ live ນີ້ແລ້ວ");
  if (!session.fbVideoId) throw new Error("ຜູກວິດີໂອ live ກ່ອນ ຈຶ່ງ boost ໄດ້");
  if (!account?.fbAccountId) throw new Error("ບັນຊີໂຄສະນານີ້ຍັງບໍ່ໄດ້ຜູກກັບ Facebook");
  if (!config) throw new Error("ຍັງບໍ່ໄດ້ຕັ້ງ Facebook access token");
  if (!session.page.token || !session.page.fbPageId) {
    throw new Error("ເພຈນີ້ຍັງບໍ່ມີ page token — ໄປໜ້າ ເພຈ ແລ້ວກົດ “ເຊື່ອມເພຈກັບ Facebook”");
  }

  const input: BoostInput = { ...request, currency: account.currency };
  const rate = await latestRate(account.currency);
  const problems = validateBoost(input, cap, rate);
  if (problems.length) throw new Error(problems.join(" · "));

  const story = await findVideoStory(
    config,
    { fbPageId: session.page.fbPageId, token: session.page.token },
    session.fbVideoId,
  );

  const now = new Date();
  const endsAt = new Date(now.getTime() + input.hours * 3_600_000);
  const name = boostName(session.title, now);
  const act = account.fbAccountId;

  let campaignId: string | null = null;
  try {
    campaignId = (
      await createOnce<{ id: string }>(config, `${act}/campaigns`, {
        name,
        objective: "OUTCOME_ENGAGEMENT",
        status: "PAUSED",
        buying_type: "AUCTION",
        special_ad_categories: "[]",
        // ງົບຢູ່ລະດັບຊຸດໂຄສະນາ — Facebook ບັງຄັບໃຫ້ບອກຄ່ານີ້ຕັ້ງແຕ່ v22
        is_adset_budget_sharing_enabled: "false",
      })
    ).id;

    const adSetId = (
      await createOnce<{ id: string }>(config, `${act}/adsets`, {
        name,
        campaign_id: campaignId,
        status: "PAUSED",
        lifetime_budget: String(toMinorUnits(input.budget, account.currency)),
        start_time: now.toISOString(),
        end_time: endsAt.toISOString(),
        billing_event: "IMPRESSIONS",
        optimization_goal: "POST_ENGAGEMENT",
        bid_strategy: "LOWEST_COST_WITHOUT_CAP",
        targeting: JSON.stringify(buildTargeting(input)),
      })
    ).id;

    const creativeId = (
      await createOnce<{ id: string }>(config, `${act}/adcreatives`, { name, object_story_id: story })
    ).id;

    const adId = (
      await createOnce<{ id: string }>(config, `${act}/ads`, {
        name,
        adset_id: adSetId,
        creative: JSON.stringify({ creative_id: creativeId }),
        status: "PAUSED",
      })
    ).id;

    const boost = await prisma.liveBoost.create({
      data: {
        sessionId,
        adAccountId: account.id,
        fbCampaignId: campaignId,
        fbAdSetId: adSetId,
        fbCreativeId: creativeId,
        fbAdId: adId,
        budget: input.budget,
        currency: account.currency,
        budgetLak: budgetInLak(input.budget, account.currency, rate),
        hours: input.hours,
        ageMin: input.ageMin,
        ageMax: input.ageMax,
        gender: input.gender,
        endsAt,
        status: "PAUSED",
        createdBy,
      },
    });
    return boost.id;
  } catch (error) {
    // ຢ່າປະແຄມເປນເຄິ່ງໆໄວ້ໃນ Ads Manager — ລຶບຖິ້ມ (ລົ້ມກໍ່ຊ່າງ ມັນຢຸດຢູ່ແລ້ວ)
    if (campaignId) {
      await post(config, campaignId, { status: "DELETED" }).catch(() => {});
    }
    throw new Error(explainBoostError(error));
  }
}

/** ຂໍ້ຜິດພາດທີ່ພົບເລື້ອຍຕອນສ້າງໂຄສະນາ — ບອກວິທີແກ້ ບໍ່ແມ່ນລະຫັດ */
function explainBoostError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/payment|funding|billing/i.test(message)) {
    return "ບັນຊີໂຄສະນາບໍ່ມີວິທີຊຳລະ ຫຼື ຊຳລະຄ້າງ — ກວດຢູ່ Ads Manager ກ່ອນ";
  }
  if (/pages_manage_ads|page.*permission|not.*authorized.*page/i.test(message)) {
    return "token ບໍ່ມີສິດໃຊ້ໂພສຂອງເພຈເປັນໂຄສະນາ (ຕ້ອງມີ pages_manage_ads ແລະ ເປັນ Advertiser ຂອງເພຈ)";
  }
  if (/budget.*(too low|minimum)|minimum.*budget/i.test(message)) {
    return "ງົບຕ່ຳກວ່າຂັ້ນຕ່ຳຂອງ Facebook ສຳລັບໄລຍະເວລານີ້ — ເພີ່ມງົບ ຫຼື ຫຼຸດຈຳນວນຊົ່ວໂມງ";
  }
  return explainFbError(error);
}

// ------------------------------------------------------------ ຍິງ / ຢຸດ / ຕິດຕາມ

/**
 * ຍິງ ຫຼື ຢຸດ. ຍິງ = ເປີດທັງ 3 ຊັ້ນ (ad ທີ່ຢຸດຢູ່ບໍ່ແລ່ນ ເຖິງແຄມເປນເປີດ).
 * ຢຸດ = ຢຸດແຄມເປນກ່ອນ (ຕັດເງິນທັນທີ) ແລ້ວຄ່ອຍຢຸດຊັ້ນລຸ່ມ.
 */
export async function setLiveBoostRunning(boostId: string, running: boolean): Promise<void> {
  const [boost, config] = await Promise.all([
    prisma.liveBoost.findUnique({ where: { id: boostId } }),
    getFbConfig(),
  ]);
  if (!boost?.fbCampaignId || !boost.fbAdSetId || !boost.fbAdId) throw new Error("ບໍ່ພົບການ boost ນີ້");
  if (!config) throw new Error("ຍັງບໍ່ໄດ້ຕັ້ງ Facebook access token");
  if (running && boost.endsAt.getTime() <= Date.now()) {
    throw new Error("ການ boost ນີ້ໝົດເວລາແລ້ວ — ສ້າງໃໝ່");
  }

  const status = running ? "ACTIVE" : "PAUSED";
  const order = running
    ? [boost.fbAdId, boost.fbAdSetId, boost.fbCampaignId]
    : [boost.fbCampaignId, boost.fbAdSetId, boost.fbAdId];
  for (const id of order) await post(config, id, { status });

  await prisma.liveBoost.update({ where: { id: boostId }, data: { status, error: null } });
  await refreshLiveBoost(boostId).catch(() => {});
}

/** ສະຖານະຈິງ (ລໍກວດ/ຖືກປະຕິເສດ) ແລະ ເງິນທີ່ໃຊ້ໄປ — ຄົນກົດອັບເດດເອງ ບໍ່ດຶງທຸກຮອບໜ້າຈໍ */
export async function refreshLiveBoost(boostId: string): Promise<void> {
  const [boost, config] = await Promise.all([
    prisma.liveBoost.findUnique({ where: { id: boostId } }),
    getFbConfig(),
  ]);
  if (!boost?.fbAdId || !boost.fbCampaignId || !config) return;

  try {
    const ad = await get<{
      effective_status?: string;
      ad_review_feedback?: { global?: Record<string, string> };
    }>(config, boost.fbAdId, { fields: "effective_status,ad_review_feedback" });

    const insights = await get<{ data?: { spend?: string; reach?: string; impressions?: string }[] }>(
      config,
      `${boost.fbCampaignId}/insights`,
      { fields: "spend,reach,impressions", date_preset: "maximum" },
    );
    const row = insights.data?.[0];

    await prisma.liveBoost.update({
      where: { id: boostId },
      data: {
        effectiveStatus: ad.effective_status ?? null,
        reviewNote: ad.ad_review_feedback?.global
          ? Object.values(ad.ad_review_feedback.global).join(" · ")
          : null,
        // insights ຄືນ spend ເປັນຫົວໜ່ວຍເຕັມແລ້ວ (ບໍ່ແມ່ນ minor units)
        spend: row?.spend ? Number(row.spend) : 0,
        reach: row?.reach ? Number(row.reach) : 0,
        impressions: row?.impressions ? Number(row.impressions) : 0,
        checkedAt: new Date(),
        error: null,
      },
    });
  } catch (error) {
    await prisma.liveBoost.update({
      where: { id: boostId },
      data: { error: explainFbError(error), checkedAt: new Date() },
    });
  }
}

/** ຄ່າທີ່ໜ້າ boost ຕ້ອງໃຊ້ — ບັນຊີ, ເພດານ, ອັດຕາແລກປ່ຽນ */
export async function loadBoostContext() {
  const [accounts, cap] = await Promise.all([
    prisma.adAccount.findMany({
      where: { fbAccountId: { not: null }, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, currency: true },
    }),
    readBoostCap(),
  ]);
  const rates = Object.fromEntries(
    await Promise.all(
      [...new Set(accounts.map((a) => a.currency))].map(async (c) => [c, await latestRate(c)] as const),
    ),
  );
  return { accounts, cap, rates };
}

