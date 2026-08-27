import { prisma } from "./prisma";
import { addDays, todayStr, type DateRange } from "./date";
import {
  activeSyncLog,
  checkFbToken,
  getFbConfig,
  runSyncJob,
  startSyncLog,
  type SyncLevels,
} from "./fb";
import { syncInbox } from "./fb-inbox";

/**
 * ຕົວຕັ້ງເວລາດຶງຂໍ້ມູນເອງ — ບໍ່ຕ້ອງລໍຄົນກົດປຸ່ມ “ດຶງຂໍ້ມູນດຽວນີ້”.
 *
 * ແລ່ນຢູ່ໃນ process ດຽວກັນກັບເວັບ (ເລີ່ມຈາກ `src/instrumentation.ts`)
 * ຈຶ່ງ **ຕ້ອງໃຫ້ບໍລິການເປີດຢູ່** ຈຶ່ງຈະດຶງ — ປິດເຄື່ອງແລ້ວບໍ່ມີຫຍັງແລ່ນ.
 *
 * ດຶງແຕ່ລະດັບແຄມເປນ (+ ຜົນແຍກກຸ່ມຖ້າເປີດໄວ້) ຍ້ອນຫຼັງຕາມຈຳນວນວັນທີ່ຕັ້ງ
 * ເພາະ Facebook ຍັງແກ້ຕົວເລກຍ້ອນຫຼັງໄດ້ຫຼາຍວັນ — ດຶງທັບຄືນຈຶ່ງໄດ້ເລກຫຼ້າສຸດ.
 */

export type AutoSync = {
  enabled: boolean;
  /** ດຶງທຸກໆກີ່ນາທີ (ນັບຈາກການດຶງຄັ້ງລ່າສຸດ ບໍ່ວ່າຄົນກົດ ຫຼື ອັດຕະໂນມັດ) */
  everyMin: number;
  /** ດຶງຍ້ອນຫຼັງກີ່ວັນ (ນັບມື້ນີ້ນຳ) */
  days: number;
  segments: boolean;
};

export const AUTO_SYNC_KEYS: Record<keyof AutoSync, string> = {
  enabled: "autoSyncEnabled",
  everyMin: "autoSyncEveryMin",
  days: "autoSyncDays",
  segments: "autoSyncSegments",
};

export const DEFAULT_AUTO_SYNC: AutoSync = {
  enabled: false,
  everyMin: 360, // 6 ຊົ່ວໂມງ
  days: 7,
  segments: true,
};

/** ໄລຍະຫ່າງທີ່ໃຫ້ເລືອກ (ນາທີ) — ຖີ່ກວ່ານີ້ກິນໂຄຕ້າ API ໂດຍບໍ່ໄດ້ເລກໃໝ່ຫຍັງ */
export const AUTO_SYNC_INTERVALS = [30, 60, 180, 360, 720, 1440] as const;
export const AUTO_SYNC_DAY_CHOICES = [3, 7, 14, 30] as const;

export function intervalLabel(min: number): string {
  if (min < 60) return `ທຸກໆ ${min} ນາທີ`;
  const hours = min / 60;
  return hours === 24 ? "ມື້ລະເທື່ອ" : `ທຸກໆ ${hours} ຊົ່ວໂມງ`;
}

export async function getAutoSync(): Promise<AutoSync> {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: Object.values(AUTO_SYNC_KEYS) } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const everyMin = Number(map.get(AUTO_SYNC_KEYS.everyMin));
  const days = Number(map.get(AUTO_SYNC_KEYS.days));

  return {
    enabled: map.get(AUTO_SYNC_KEYS.enabled) === "1",
    everyMin: (AUTO_SYNC_INTERVALS as readonly number[]).includes(everyMin)
      ? everyMin
      : DEFAULT_AUTO_SYNC.everyMin,
    days: (AUTO_SYNC_DAY_CHOICES as readonly number[]).includes(days)
      ? days
      : DEFAULT_AUTO_SYNC.days,
    // ບໍ່ເຄີຍບັນທຶກ = ໃຊ້ຄ່າຕັ້ງຕົ້ນ (ເປີດ), ບັນທຶກແລ້ວຈຶ່ງເຊື່ອຄ່າໃນຖານຂໍ້ມູນ
    segments: map.has(AUTO_SYNC_KEYS.segments)
      ? map.get(AUTO_SYNC_KEYS.segments) === "1"
      : DEFAULT_AUTO_SYNC.segments,
  };
}

/** ເວລາທີ່ດຶງຄັ້ງລ່າສຸດ — ນັບທັງຄົນກົດ ແລະ ອັດຕະໂນມັດ ຈຶ່ງບໍ່ດຶງຊ້ຳຕິດກັນ */
async function lastSyncStartedAt(): Promise<Date | null> {
  const last = await prisma.syncLog.findFirst({
    orderBy: { startedAt: "desc" },
    select: { startedAt: true },
  });
  return last?.startedAt ?? null;
}

export type AutoSyncStatus = {
  settings: AutoSync;
  lastAt: Date | null;
  /** ຮອບຕໍ່ໄປ (ໂດຍປະມານ — ຕົວຕັ້ງເວລາກວດທຸກໆນາທີ) */
  nextAt: Date | null;
  /** ຮອດເວລາແລ້ວ — ຈະດຶງໃນການກວດຮອບໜ້າ */
  dueNow: boolean;
};

export async function autoSyncStatus(): Promise<AutoSyncStatus> {
  const settings = await getAutoSync();
  const lastAt = await lastSyncStartedAt();
  const nextAt = lastAt
    ? new Date(lastAt.getTime() + settings.everyMin * 60_000)
    : new Date();

  return {
    settings,
    lastAt,
    nextAt: settings.enabled ? nextAt : null,
    dueNow: settings.enabled && nextAt.getTime() <= Date.now(),
  };
}

/** ຊ່ວງວັນທີ່ຮອບອັດຕະໂນມັດຈະດຶງ */
export function autoSyncRange(days: number): DateRange {
  const to = todayStr();
  return { from: addDays(to, -(days - 1)), to };
}

// ກັນສອງຮອບຊ້ອນກັນໃນ process ດຽວ (ຮອບໜຶ່ງອາດແລ່ນດົນກວ່າໄລຍະກວດ)
let ticking = false;

/**
 * ກວດເທື່ອໜຶ່ງວ່າຮອດເວລາດຶງແລ້ວບໍ່ ແລ້ວດຶງຖ້າຮອດ.
 * ບໍ່ throw ອອກມາ — ຄວາມຜິດພາດຂອງການດຶງຖືກບັນທຶກລົງ SyncLog ໂດຍ `runSyncJob`.
 */
export async function tickAutoSync(): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    const settings = await getAutoSync();
    if (!settings.enabled) return;

    // ບໍ່ມີ token ກໍ່ບໍ່ຕ້ອງລອງ — ບໍ່ດັ່ງນັ້ນປະຫວັດຈະເຕັມໄປດ້ວຍແຖວ “ຜິດພາດ”
    if (!(await getFbConfig())) return;

    // ມີວຽກແລ່ນຢູ່ (ຄົນກົດເອງກໍ່ນັບ) — ລໍຮອບໜ້າ
    if (await activeSyncLog()) return;

    const lastAt = await lastSyncStartedAt();
    if (lastAt && Date.now() - lastAt.getTime() < settings.everyMin * 60_000) {
      return;
    }

    const range = autoSyncRange(settings.days);
    const levels: SyncLevels = {
      campaign: true,
      adset: false,
      ad: false,
      segments: settings.segments,
    };

    const log = await startSyncLog(range, levels, true);
    await runSyncJob(log.id, range, levels);
  } catch (error) {
    // ຖານຂໍ້ມູນຍັງບໍ່ຂຶ້ນ / ມີວຽກຊ້ອນ — ລອງໃໝ່ຮອບໜ້າ
    console.error("[auto-sync]", error);
  } finally {
    ticking = false;
  }
}


// ------------------------------------------------- ກ່ອງຂໍ້ຄວາມ (comment / ແຊັດ)

export type AutoInbox = {
  enabled: boolean;
  everyMin: number;
};

export const AUTO_INBOX_KEYS: Record<keyof AutoInbox, string> = {
  enabled: "autoInboxEnabled",
  everyMin: "autoInboxEveryMin",
};

/** ສະຖານະຮອບຫຼ້າສຸດ — ເກັບເປັນຄ່າຕັ້ງ ບໍ່ໄດ້ເຮັດຕາຕະລາງ log ຕ່າງຫາກ */
const INBOX_STATE_KEYS = {
  syncedAt: "inboxSyncedAt",
  result: "inboxLastResult",
  error: "inboxLastError",
};

export const DEFAULT_AUTO_INBOX: AutoInbox = { enabled: false, everyMin: 15 };

/** ດຶງຖີ່ກວ່າ 5 ນາທີບໍ່ຄຸ້ມ — ກິນໂຄຕ້າ API ໂດຍໃຊ່ເຫດ */
export const AUTO_INBOX_INTERVALS = [5, 15, 30, 60, 180] as const;

export async function getAutoInbox(): Promise<AutoInbox> {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: Object.values(AUTO_INBOX_KEYS) } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const everyMin = Number(map.get(AUTO_INBOX_KEYS.everyMin));

  return {
    enabled: map.get(AUTO_INBOX_KEYS.enabled) === "1",
    everyMin: (AUTO_INBOX_INTERVALS as readonly number[]).includes(everyMin)
      ? everyMin
      : DEFAULT_AUTO_INBOX.everyMin,
  };
}

export type InboxState = {
  settings: AutoInbox;
  syncedAt: Date | null;
  result: string | null;
  error: string | null;
  nextAt: Date | null;
  dueNow: boolean;
};

export async function inboxState(): Promise<InboxState> {
  const settings = await getAutoInbox();
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: Object.values(INBOX_STATE_KEYS) } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const raw = map.get(INBOX_STATE_KEYS.syncedAt);
  const syncedAt = raw ? new Date(raw) : null;
  const nextAt = syncedAt
    ? new Date(syncedAt.getTime() + settings.everyMin * 60_000)
    : new Date();

  return {
    settings,
    syncedAt,
    result: map.get(INBOX_STATE_KEYS.result) ?? null,
    error: map.get(INBOX_STATE_KEYS.error) || null,
    nextAt: settings.enabled ? nextAt : null,
    dueNow: settings.enabled && nextAt.getTime() <= Date.now(),
  };
}

async function putState(key: string, value: string) {
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

/**
 * ດຶງກ່ອງຂໍ້ຄວາມ 1 ຮອບ ພ້ອມບັນທຶກຜົນ — ໃຊ້ທັງປຸ່ມກົດເອງ ແລະ ຕົວຕັ້ງເວລາ.
 * ບໍ່ throw — ຄວາມຜິດພາດຖືກເກັບໄວ້ໃຫ້ໜ້າຈໍສະແດງແທນ.
 */
export async function runInboxSync(): Promise<void> {
  try {
    const result = await syncInbox();
    await putState(INBOX_STATE_KEYS.syncedAt, new Date().toISOString());
    await putState(
      INBOX_STATE_KEYS.result,
      `comment ໃໝ່ ${result.comments} · ຫ້ອງແຊັດ ${result.threads} · ຂໍ້ຄວາມ ${result.messages}`,
    );
    await putState(INBOX_STATE_KEYS.error, result.errors.join(" | "));
  } catch (error) {
    // ບັນທຶກເວລານຳ ບໍ່ດັ່ງນັ້ນຮອບອັດຕະໂນມັດຈະລອງຊ້ຳທຸກໆນາທີ
    await putState(INBOX_STATE_KEYS.syncedAt, new Date().toISOString());
    await putState(
      INBOX_STATE_KEYS.error,
      error instanceof Error ? error.message : String(error),
    );
  }
}

let inboxTicking = false;

/**
 * ດຶງກ່ອງຂໍ້ຄວາມ "ດຽວນີ້" ຕາມການແຈ້ງຈາກ webhook.
 *
 * ບໍ່ໄດ້ຂຽນຂໍ້ມູນຈາກ payload ຂອງ webhook ໂດຍກົງ — ໃຫ້ `syncInbox()` ດຶງເອງ
 * ເພື່ອບໍ່ໃຫ້ມີ**ສອງເສັ້ນທາງຂຽນ**ທີ່ຄ່ອຍໆເພື້ອນຈາກກັນ. webhook ໃຫ້ "ຄວາມໄວ"
 * ສ່ວນ `syncInbox()` ໃຫ້ "ຄວາມຖືກຕ້ອງ" (page token, ໂພສໂຄສະນາ, ກັນຊ້ຳ).
 *
 * Facebook ສົ່ງແຈ້ງມາຖີ່ຫຼາຍຕອນມີຄົນຄຸຍກັນ — ຈຶ່ງເວັ້ນໄລຍະໄວ້
 * ບໍ່ດັ່ງນັ້ນຮອບດຶງຈະຊ້ອນກັນຈົນຊົນ rate limit ຂອງ Facebook ເອງ.
 */
const WEBHOOK_MIN_GAP_MS = 30_000;

let lastWebhookSync = 0;

export async function syncInboxFromWebhook(): Promise<void> {
  if (inboxTicking) return;
  if (Date.now() - lastWebhookSync < WEBHOOK_MIN_GAP_MS) return;

  // ບໍ່ມີເພຈທີ່ຕໍ່ token ໄວ້ ກໍ່ບໍ່ຕ້ອງເອີ້ນ API
  const ready = await prisma.fbPage.count({
    where: { inboxOn: true, token: { not: null } },
  });
  if (ready === 0) return;

  lastWebhookSync = Date.now();
  inboxTicking = true;
  try {
    await runInboxSync();
  } finally {
    inboxTicking = false;
  }
}

async function tickAutoInbox(): Promise<void> {
  if (inboxTicking) return;
  inboxTicking = true;
  try {
    const state = await inboxState();
    if (!state.settings.enabled || !state.dueNow) return;
    if (!(await getFbConfig())) return;

    // ບໍ່ມີເພຈທີ່ຕໍ່ token ໄວ້ ກໍ່ບໍ່ຕ້ອງເອີ້ນ API
    const ready = await prisma.fbPage.count({
      where: { inboxOn: true, token: { not: null } },
    });
    if (ready === 0) return;

    await runInboxSync();
  } catch (error) {
    console.error("[auto-inbox]", error);
  } finally {
    inboxTicking = false;
  }
}

// --------------------------------------------------- ກວດອາຍຸ token ເປັນໄລຍະ

/**
 * ກວດ token ຫ່າງກັນ 6 ຊົ່ວໂມງ — ຖີ່ກວ່ານີ້ບໍ່ໄດ້ຫຍັງເພີ່ມ ເພາະວັນໝົດອາຍຸ
 * ບໍ່ໄດ້ປ່ຽນເອງ. ກວດແຍກຈາກການດຶງຂໍ້ມູນ ເພື່ອໃຫ້ຮູ້ວ່າ token ຈະໝົດ
 * **ເຖິງແມ່ນປິດການດຶງອັດຕະໂນມັດໄວ້** ຫຼື ບໍ່ມີແຄມເປນທີ່ຍິງຢູ່.
 */
const TOKEN_CHECK_MS = 6 * 60 * 60 * 1000;

let lastTokenCheck = 0;

async function tickTokenCheck(): Promise<void> {
  if (Date.now() - lastTokenCheck < TOKEN_CHECK_MS) return;
  try {
    if (!(await getFbConfig())) return;
    // ໝາຍເວລາໄວ້ກ່ອນເອີ້ນ — ຖ້າ Facebook ລົ້ມ ຈະບໍ່ໄດ້ລອງຊ້ຳທຸກໆນາທີ
    lastTokenCheck = Date.now();
    await checkFbToken();
  } catch (error) {
    console.error("[token-check]", error);
  }
}

/** ກວດທຸກໆນາທີ — ຖືກ ແລ້ວແຕ່ວ່າຮອດເວລາບໍ່ ຈຶ່ງດຶງຈິງ */
const TICK_MS = 60_000;
/** ລໍໃຫ້ເຊີບເວີ/ຖານຂໍ້ມູນຕັ້ງໂຕກ່ອນຈຶ່ງກວດຮອບທຳອິດ */
const FIRST_TICK_MS = 20_000;

let timer: ReturnType<typeof setInterval> | null = null;

/** ເອີ້ນເທື່ອດຽວຕອນເຊີບເວີຂຶ້ນ (ເບິ່ງ `src/instrumentation.ts`) */
export function startAutoSyncScheduler(): void {
  if (timer) return;

  const tick = async () => {
    await tickTokenCheck();
    await tickAutoSync();
    await tickAutoInbox();
  };

  const first = setTimeout(() => void tick(), FIRST_TICK_MS);
  first.unref?.();

  timer = setInterval(() => void tick(), TICK_MS);
  // ຢ່າໃຫ້ຕົວຕັ້ງເວລາກັນ process ດັບຕອນສັ່ງປິດ — ເຊີບເວີເວັບເປັນຕົວຄ້ຳ process ຢູ່ແລ້ວ
  timer.unref?.();

  // ບອກໄວ້ໃນ log ຂອງບໍລິການ (journalctl -u fbmonoy) ວ່າຕົວຕັ້ງເວລາຂຶ້ນແລ້ວ —
  // ບໍ່ດັ່ງນັ້ນຄົນເບິ່ງບໍ່ອອກວ່າ “ບໍ່ດຶງ” ຍ້ອນປິດໄວ້ ຫຼື ຍ້ອນຕົວຕັ້ງເວລາບໍ່ແລ່ນ
  console.log(`[auto-sync] ຕົວຕັ້ງເວລາເລີ່ມແລ້ວ — ກວດທຸກໆ ${TICK_MS / 1000} ວິນາທີ`);
}
