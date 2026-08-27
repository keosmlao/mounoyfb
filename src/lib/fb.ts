import { prisma } from "./prisma";
import { chunkRange, countDays, parseDate, type DateRange } from "./date";
import { InsightLevel, SegmentKind, type EntityStatus } from "@/generated/prisma/enums";
import { SEGMENT_DEFS, buildSegKey } from "./segments";
import { fromMinorUnits, toMinorUnits } from "./money";
import {
  actionValue,
  budgetFromMinor,
  dateOnly,
  explainFbError,
  LEAD_ACTIONS,
  mapAccountStatus,
  mapObjective,
  mapStatus,
  MESSAGE_ACTIONS,
  PURCHASE_ACTIONS,
  summarizeTargeting,
  VIDEO_ACTIONS,
  type FbAction,
} from "./fb-map";

// ຜູ້ໃຊ້ເກົ່າ import ຈາກໄຟລ໌ນີ້ — ສົ່ງຕໍ່ໃຫ້ ບໍ່ຕ້ອງແກ້ທຸກບ່ອນ
export { explainFbError } from "./fb-map";
import { UNKNOWN_TOKEN, type TokenState } from "./sync-health";

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

type GraphError = {
  message: string;
  type?: string;
  code: number;
  error_subcode?: number;
  error_user_msg?: string;
};

type GraphResponse<T> = {
  data?: T[];
  paging?: { next?: string };
  error?: GraphError;
};

/**
 * ລະຫັດຜິດພາດທີ່ "ລໍແລ້ວລອງໃໝ່ອາດຜ່ານ" — ຮ້ອງຖີ່ເກີນ ຫຼື ຝັ່ງ Facebook ຂັດຂ້ອງເອງ.
 * 1/2 = ຂັດຂ້ອງຊົ່ວຄາວ · 4/17/32/341/613 = ຊົນເພດານການຮ້ອງ.
 * ນອກຈາກນີ້ (ເຊັ່ນ 190 token ຕາຍ, 100 ບໍ່ພົບ) ລອງອີກກໍ່ໄດ້ຜົນເກົ່າ ຈຶ່ງບໍ່ລອງ.
 */
const RETRYABLE_CODES = new Set([1, 2, 4, 17, 32, 341, 613]);

/**
 * ລໍດົນຂຶ້ນເລື່ອຍໆ — ເພດານຂອງ Facebook ນັບເປັນຊ່ວງເວລາ ການລອງຖີ່ໆ
 * ມີແຕ່ຈະຍືດເວລາຖືກບລັອກໃຫ້ດົນຂຶ້ນ.
 *
 * ລວມແລ້ວລໍບໍ່ເກີນ 30 ວິນາທີ ຈຶ່ງບໍ່ຊົນກົດ "ວຽກຄ້າງ 15 ນາທີ" ຂອງ `activeSyncLog()`
 * (heartbeat ຂອງ `runSyncJob` ອັບເດດທຸກ 1 ນາທີຢູ່ແລ້ວ).
 */
const RETRY_DELAYS_MS = [2_000, 8_000, 20_000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function graphErrorOf(error: GraphError): Error {
  const detail = error.error_user_msg ?? error.message;
  return new Error(`Facebook API: ${detail} (code ${error.code})`);
}

/**
 * ຮ້ອງ Graph API 1 ເທື່ອ ພ້ອມລອງໃໝ່ເມື່ອຊົນເພດານ ຫຼື ເນັດຂັດ.
 *
 * ກ່ອນນີ້ການດຶງຍ້ອນຫຼັງຍາວໆ ພໍຊົນ rate limit ກາງທາງແມ່ນ **ລົ້ມທັງວຽກ**
 * ແລ້ວຕ້ອງເລີ່ມໃໝ່ຕັ້ງແຕ່ຕົ້ນ — ເສຍທັງເວລາ ແລະ ໂຄຕ້າທີ່ໃຊ້ໄປແລ້ວ.
 */
async function graphFetch<T>(
  url: string,
  init?: RequestInit,
): Promise<T & { error?: GraphError }> {
  let lastError: Error = new Error("Facebook API: ຮ້ອງບໍ່ສຳເລັດ");

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1]);

    try {
      const res = await fetch(url, { cache: "no-store", ...init });
      const json = (await res.json()) as T & { error?: GraphError };

      if (json.error && RETRYABLE_CODES.has(json.error.code)) {
        lastError = graphErrorOf(json.error);
        continue;
      }
      return json;
    } catch (error) {
      // ເນັດຂັດ / ຕອບບໍ່ເປັນ JSON — ລອງໃໝ່ໄດ້ຄືກັນ
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError;
}

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
    const json = await graphFetch<GraphResponse<T>>(url);

    if (json.error) throw graphErrorOf(json.error);
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
  const json = await graphFetch<T>(
    `${GRAPH}/${config.apiVersion}/${path}?${search.toString()}`,
  );
  if (json.error) throw graphErrorOf(json.error);
  return json;
}

/** ຂຽນຄ່າກັບໄປ Facebook (POST) — ໃຊ້ token ຫຼັກ ຈຶ່ງຕ້ອງມີສິດ `ads_management` */
async function graphWrite(
  config: FbConfig,
  path: string,
  body: Record<string, string>,
): Promise<void> {
  // ລອງໃໝ່ໄດ້ຢ່າງປອດໄພ — ການສັ່ງເປັນ "ຕັ້ງຄ່າໃຫ້ເປັນ X" ບໍ່ແມ່ນ "ບວກ X"
  // ສັ່ງຊ້ຳຈຶ່ງໄດ້ຜົນອັນດຽວກັນ
  const json = await graphFetch<{ success?: boolean }>(
    `${GRAPH}/${config.apiVersion}/${path}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        ...body,
        access_token: config.accessToken,
      }).toString(),
    },
  );
  // error_user_msg ມັກບອກເຫດຜົນທີ່ເຂົ້າໃຈງ່າຍກວ່າ message ດິບ
  if (json.error) throw graphErrorOf(json.error);
}

/**
 * ຊ່ອງຂອງແຄມເປນທີ່ **Facebook ເປັນເຈົ້າຂອງ ແລະ ເຮົາຂຽນກັບໄປໄດ້**.
 *
 * ນອກຈາກນີ້ (ເປົ້າໝາຍ, ວັນເລີ່ມ/ຈົບ) Facebook ບໍ່ຮັບການແກ້ຫຼັງສ້າງແລ້ວ
 * ຫຼື ຮັບແບບບໍ່ແນ່ນອນ — ຈຶ່ງລັອກໄວ້ຢູ່ຟອມແທນທີ່ຈະໃຫ້ແກ້ແລ້ວຫາຍ.
 */
export type FbCampaignEdit = {
  name?: string;
  dailyBudget?: number | null;
  lifetimeBudget?: number | null;
};

/**
 * ສົ່ງການແກ້ໄຂແຄມເປນກັບໄປ Facebook.
 *
 * ຕ້ອງເອີ້ນ **ກ່ອນ** ບັນທຶກລົງຖານຂໍ້ມູນສະເໝີ — ຖ້າ Facebook ປະຕິເສດແລ້ວ
 * ເຮົາຍັງບັນທຶກ ໜ້າຈໍຈະບອກງົບໃໝ່ ທັງທີ່ Facebook ຍັງຕັດເງິນຕາມງົບເກົ່າ
 * ແລະ ຮອບ sync ຖັດໄປຈະທັບຄ່າຂອງເຮົາຖິ້ມຢູ່ດີ.
 *
 * ງົບຕ້ອງສົ່ງເປັນ**ຫົວໜ່ວຍນ້ອຍສຸດ**ຂອງສະກຸນບັນຊີ ($5.00 → "500").
 */
export async function updateFbCampaign(
  fbCampaignId: string,
  fields: FbCampaignEdit,
  currency: string,
): Promise<void> {
  const config = await getFbConfig();
  if (!config) {
    throw new Error("ຍັງບໍ່ໄດ້ຕັ້ງ Facebook access token — ສັ່ງໄປ Facebook ບໍ່ໄດ້");
  }

  const body: Record<string, string> = {};
  if (fields.name !== undefined) body.name = fields.name;

  // ສົ່ງງົບໄດ້ເທື່ອລະແບບ — Facebook ປະຕິເສດຖ້າສົ່ງທັງລາຍວັນ ແລະ ລາຍລວມພ້ອມກັນ
  if (fields.dailyBudget !== undefined && fields.dailyBudget !== null) {
    body.daily_budget = String(toMinorUnits(fields.dailyBudget, currency));
  } else if (
    fields.lifetimeBudget !== undefined &&
    fields.lifetimeBudget !== null
  ) {
    body.lifetime_budget = String(toMinorUnits(fields.lifetimeBudget, currency));
  }

  if (Object.keys(body).length === 0) return;
  await graphWrite(config, fbCampaignId, body);
}

// ------------------------------------------------------------ ສຸຂະພາບຂອງ token

/**
 * ຜົນການກວດ token ຖືກເກັບໄວ້ໃນ `AppSetting` ບໍ່ແມ່ນກວດສົດທຸກເທື່ອ —
 * `buildAlerts()` ຖືກເອີ້ນທຸກຄັ້ງທີ່ເປີດໜ້າ ຖ້າໄປເອີ້ນ Facebook ນຳ
 * ໜ້າຈໍຈະຊ້າ ແລະ ກິນໂຄຕ້າ API ຈົນຊົນ rate limit.
 */
const TOKEN_STATE_KEYS = {
  checkedAt: "fbTokenCheckedAt",
  valid: "fbTokenValid",
  expiresAt: "fbTokenExpiresAt",
  error: "fbTokenError",
} as const;

async function putTokenState(key: string, value: string) {
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

/** ອ່ານຜົນການກວດຄັ້ງຫຼ້າສຸດ — ບໍ່ເອີ້ນ Facebook */
export async function readTokenState(): Promise<TokenState> {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: Object.values(TOKEN_STATE_KEYS) } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const checkedAt = map.get(TOKEN_STATE_KEYS.checkedAt);
  const valid = map.get(TOKEN_STATE_KEYS.valid);
  const expiresAt = map.get(TOKEN_STATE_KEYS.expiresAt);

  return {
    checkedAt: checkedAt ? new Date(checkedAt) : null,
    valid: valid === undefined ? null : valid === "1",
    // ຄ່າວ່າງ = ບໍ່ໝົດອາຍຸ (token ຂອງ system user) — ຄົນລະຢ່າງກັບ "ຍັງບໍ່ຮູ້"
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    error: map.get(TOKEN_STATE_KEYS.error) || null,
  };
}

type DebugTokenResponse = {
  data?: {
    is_valid?: boolean;
    /** unix seconds — 0 ຫຼື ບໍ່ມີ = ບໍ່ໝົດອາຍຸ */
    expires_at?: number;
    scopes?: string[];
    error?: { message?: string; code?: number };
  };
};

/**
 * ຖາມ Facebook ວ່າ token ຍັງໃຊ້ໄດ້ບໍ່ ແລະ ຈະໝົດອາຍຸເມື່ອໃດ ແລ້ວເກັບຜົນໄວ້.
 *
 * ເອີ້ນຈາກຕົວຕັ້ງເວລາ (ມື້ລະສອງສາມເທື່ອ) ແລະ ຕອນຄົນກົດ “ທົດສອບການເຊື່ອມຕໍ່”.
 * ບໍ່ throw — ຄືນສະຖານະທີ່ຮູ້ໄດ້ ເພື່ອບໍ່ໃຫ້ວຽກອື່ນລົ້ມຕາມ.
 */
export async function checkFbToken(): Promise<TokenState> {
  const config = await getFbConfig();
  if (!config) return UNKNOWN_TOKEN;

  const save = async (state: TokenState) => {
    await putTokenState(TOKEN_STATE_KEYS.checkedAt, new Date().toISOString());
    await putTokenState(TOKEN_STATE_KEYS.valid, state.valid ? "1" : "0");
    await putTokenState(
      TOKEN_STATE_KEYS.expiresAt,
      state.expiresAt ? state.expiresAt.toISOString() : "",
    );
    await putTokenState(TOKEN_STATE_KEYS.error, state.error ?? "");
    return state;
  };

  try {
    const res = await graphOne<DebugTokenResponse>(config, "debug_token", {
      input_token: config.accessToken,
    });
    const data = res.data;
    if (data?.is_valid === false) {
      return save({
        checkedAt: new Date(),
        valid: false,
        expiresAt: null,
        error: data.error?.message ?? "Facebook ບອກວ່າ token ນີ້ໃຊ້ບໍ່ໄດ້ແລ້ວ",
      });
    }
    return save({
      checkedAt: new Date(),
      valid: true,
      // expires_at = 0 ແປວ່າບໍ່ໝົດອາຍຸ ບໍ່ແມ່ນ "ໝົດຕັ້ງແຕ່ປີ 1970"
      expiresAt: data?.expires_at ? new Date(data.expires_at * 1000) : null,
      error: null,
    });
  } catch {
    // ບາງ token ກວດຕົວເອງຜ່ານ debug_token ບໍ່ໄດ້ (ຕ້ອງໃຊ້ app token) —
    // ຖອຍໄປຮ້ອງ /me ແທນ: ຜ່ານ = ຍັງໃຊ້ໄດ້ ແຕ່ບໍ່ຮູ້ວັນໝົດອາຍຸ
    try {
      await graphOne<{ id: string }>(config, "me", { fields: "id" });
      return save({
        checkedAt: new Date(),
        valid: true,
        expiresAt: null,
        error: null,
      });
    } catch (meError) {
      return save({
        checkedAt: new Date(),
        valid: false,
        expiresAt: null,
        error: explainFbError(meError),
      });
    }
  }
}

/** ສະຖານະທີ່ສັ່ງກັບໄປ Facebook ໄດ້ — ອັນອື່ນເປັນສະຖານະພາຍໃນລະບົບເຮົາເອງ */
export type FbRunStatus = "ACTIVE" | "PAUSED";

/**
 * ຢຸດ / ໃຫ້ຍິງຕໍ່ ຢູ່ Facebook ຕົວຈິງ.
 *
 * ໃຊ້ໄດ້ກັບທັງ campaign / ad set / ad ເພາະ Graph API ໃຊ້ຮູບແບບດຽວກັນ:
 * `POST /{id}` ພ້ອມ `status`. ຢຸດແຄມເປນ = ຢຸດທຸກຊຸດ/ຊິ້ນທີ່ຢູ່ລຸ່ມມັນນຳ.
 *
 * ຖ້າ token ຂາດສິດ `ads_management` Facebook ຈະຕອບຜິດພາດກັບມາ ແລະ
 * ຜູ້ເອີ້ນຕ້ອງບໍ່ໄປອັບເດດສະຖານະໃນຖານຂໍ້ມູນ — ບໍ່ດັ່ງນັ້ນໜ້າຈໍຈະໂຊຫຼອກ.
 */
export async function setFbRunStatus(
  fbId: string,
  status: FbRunStatus,
): Promise<void> {
  const config = await getFbConfig();
  if (!config) {
    throw new Error("ຍັງບໍ່ໄດ້ຕັ້ງ Facebook access token — ສັ່ງໄປ Facebook ບໍ່ໄດ້");
  }
  await graphWrite(config, fbId, { status });
}

// ------------------------------------------------- ທົດສອບການເຊື່ອມຕໍ່ / ນຳເຂົ້າ

export type FbAssetAccount = {
  fbAccountId: string;
  name: string;
  currency: string;
  status: EntityStatus;
  timezone: string | null;
  /** ວິທີຊຳລະທີ່ຜູກໄວ້ ເຊັ່ນ "Mastercard *7447" */
  fundingSource: string | null;
  // ສາມຄ່າລຸ່ມນີ້ເປັນ **ສະກຸນຂອງບັນຊີ** ແປງຈາກຫົວໜ່ວຍນ້ອຍສຸດແລ້ວ — ຢ່າລວມຂ້າມບັນຊີ
  balance: number | null;
  amountSpent: number | null;
  spendCap: number | null;
  businessName: string | null;
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
    funding_source_details?: { display_string?: string };
    business?: { name?: string };
    // ຄ່າເງິນມາເປັນຂໍ້ຄວາມ ແລະ ເປັນຫົວໜ່ວຍນ້ອຍສຸດ ("1403" = $14.03)
    balance?: string;
    amount_spent?: string;
    spend_cap?: string;
  };
  const accountFields =
    "id,name,currency,account_status,timezone_name," +
    "funding_source_details,business{name},balance,amount_spent,spend_cap";

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

  const accounts: FbAssetAccount[] = raw.map((a) => {
    const currency = a.currency ?? "USD";
    return {
      fbAccountId: a.id, // ມາເປັນຮູບແບບ act_XXXXXXXX ຢູ່ແລ້ວ
      name: a.name ?? a.id,
      currency,
      status: mapAccountStatus(a.account_status),
      timezone: a.timezone_name ?? null,
      fundingSource: a.funding_source_details?.display_string ?? null,
      businessName: a.business?.name ?? null,
      balance: fromMinorUnits(a.balance, currency),
      amountSpent: fromMinorUnits(a.amount_spent, currency),
      spendCap: fromMinorUnits(a.spend_cap, currency),
    };
  });

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

    // ຂໍ້ມູນການຊຳລະ — ອ່ານຢ່າງດຽວຈາກ Facebook ຈຶ່ງທັບໄດ້ທຸກເທື່ອ.
    // `spendCap` ທີ່ຜູ້ໃຊ້ຕັ້ງເອງ **ບໍ່ຢູ່ໃນນີ້** ໂດຍຕັ້ງໃຈ (ເບິ່ງ schema).
    const billing = {
      fbFundingSource: a.fundingSource,
      fbBusinessName: a.businessName,
      fbBalance: a.balance,
      fbAmountSpent: a.amountSpent,
      fbSpendCap: a.spendCap,
      fbBillingAt: new Date(),
    };

    if (existing) {
      await prisma.adAccount.update({
        where: { id: existing.id },
        data: { name: a.name, currency: a.currency, status: a.status, ...billing },
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
            ...billing,
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
            ...billing,
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
      dailyBudget: budgetFromMinor(c.daily_budget, account.currency),
      lifetimeBudget: budgetFromMinor(c.lifetime_budget, account.currency),
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

  // ແຄມເປນທີ່ເຄີຍມີ ແຕ່ Facebook ບໍ່ຄືນມາອີກ = ຖືກລຶບ/ເກັບເຂົ້າຄັງຢູ່ Facebook
  // (edge `/campaigns` ບໍ່ຄືນອັນທີ່ archived ຫຼື deleted).
  // **ຫ້າມລຶບອອກ** ເພາະ Insight ຈະຖືກລຶບຕາມ ແລ້ວຄ່າໂຄສະນາໃນອະດີດຈະຫາຍໄປ —
  // ໝາຍເປັນ "ເກັບເຂົ້າຄັງ" ແທນ ຈຶ່ງບໍ່ຄ້າງຢູ່ໃນລາຍການທີ່ກຳລັງຍິງ.
  const liveIds = fbCampaigns.map((c) => c.id);
  await prisma.campaign.updateMany({
    where: {
      adAccountId: account.id,
      fbCampaignId: { not: null, notIn: liveIds },
      status: { in: ["ACTIVE", "PAUSED", "DRAFT"] },
    },
    data: { status: "ARCHIVED" },
  });

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
        dailyBudget: budgetFromMinor(s.daily_budget, account.currency),
        lifetimeBudget: budgetFromMinor(s.lifetime_budget, account.currency),
        bidAmount: budgetFromMinor(s.bid_amount, account.currency),
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
export async function startSyncLog(
  range: DateRange,
  levels: SyncLevels,
  auto = false,
) {
  const running = await activeSyncLog();
  if (running) {
    throw new Error("ມີການດຶງຂໍ້ມູນແລ່ນຢູ່ແລ້ວ — ລໍໃຫ້ຮອບນີ້ຈົບກ່ອນ");
  }

  const chosen = (["campaign", "adset", "ad"] as const).filter((k) => levels[k]);

  try {
    return await prisma.syncLog.create({
      data: {
        status: "RUNNING",
        auto,
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
