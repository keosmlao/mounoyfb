import type { Alert } from "./alert-types";
import { formatDateLao, formatTimeLao } from "./date";

/**
 * ກົດເຕືອນເລື່ອງ "ຕົວລະບົບເອງ" — ບໍ່ແມ່ນຜົນຂອງໂຄສະນາ.
 *
 * ເຫດຜົນທີ່ຕ້ອງມີ: ເມື່ອ token ໝົດອາຍຸ ຫຼື ການດຶງລົ້ມ ລະບົບຈະ **ງຽບ** —
 * ໜ້າຈໍຍັງໂຊຕົວເລກເກົ່າຢູ່ຄືເກົ່າ ແລ້ວຄົນເບິ່ງກໍ່ເຊື່ອວ່າມັນຫຼ້າສຸດ
 * ຈົນຕັດສິນໃຈໃຊ້ເງິນຈາກຂໍ້ມູນທີ່ຄ້າງມາຫຼາຍວັນ.
 *
 * ໄຟລ໌ນີ້ **ບໍ່ແຕະຖານຂໍ້ມູນ** — ຮັບຄ່າທີ່ອ່ານມາແລ້ວເຂົ້າມາຢ່າງດຽວ
 * ຈຶ່ງທົດສອບໄດ້ (`sync-health.test.ts`) ໂດຍບໍ່ຕ້ອງມີ Postgres.
 */

/** ບໍ່ມີການດຶງສຳເລັດດົນກວ່ານີ້ = ຖືວ່າຂໍ້ມູນຄ້າງ */
export const DEFAULT_SYNC_STALE_HOURS = 24;

/** ເຕືອນລ່ວງໜ້າກ່ອນ token ໝົດອາຍຸຈັກວັນ */
export const TOKEN_EXPIRY_WARN_DAYS = 7;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** ຜົນການກວດ token ຫຼ້າສຸດ — ເກັບໄວ້ໃນ AppSetting, ບໍ່ໄດ້ເອີ້ນ Facebook ຕອນເປີດໜ້າ */
export type TokenState = {
  checkedAt: Date | null;
  /** null = ຍັງບໍ່ເຄີຍກວດ */
  valid: boolean | null;
  /** null = ບໍ່ໝົດອາຍຸ (token ຂອງ system user) ຫຼື ຍັງບໍ່ຮູ້ */
  expiresAt: Date | null;
  error: string | null;
};

/**
 * ເຫຼືອອີກຈັກວັນ token ຈຶ່ງໝົດອາຍຸ (null = ບໍ່ໝົດ ຫຼື ຍັງບໍ່ຮູ້).
 * ຮັບ `now` ໄດ້ ເພື່ອໃຫ້ທົດສອບໄດ້ ແລະ ເພື່ອບໍ່ໃຫ້ component ໄປອ່ານເວລາເອງ.
 */
export function tokenDaysLeft(
  state: TokenState,
  now: Date = new Date(),
): number | null {
  if (!state.expiresAt) return null;
  return Math.ceil((state.expiresAt.getTime() - now.getTime()) / DAY_MS);
}

export const UNKNOWN_TOKEN: TokenState = {
  checkedAt: null,
  valid: null,
  expiresAt: null,
  error: null,
};

export type LastSync = {
  status: "RUNNING" | "SUCCESS" | "FAILED";
  startedAt: Date;
  message: string | null;
};

export type SyncHealthInput = {
  /** ຕັ້ງ access token ໄວ້ແລ້ວບໍ່ — ຮ້ານທີ່ປ້ອນມືຢ່າງດຽວບໍ່ຕ້ອງເຕືອນເລື່ອງນີ້ */
  connected: boolean;
  autoSyncEnabled: boolean;
  lastSync: LastSync | null;
  lastSuccessAt: Date | null;
  token: TokenState;
  inboxEnabled: boolean;
  inboxError: string | null;
  staleHours: number;
  now: Date;
};

/** "3 ຊົ່ວໂມງ" / "2 ວັນ" — ໃຊ້ບອກວ່າຄ້າງມາດົນປານໃດ */
function describeSpan(ms: number): string {
  const hours = Math.floor(ms / HOUR_MS);
  if (hours < 1) return "ບໍ່ຮອດ 1 ຊົ່ວໂມງ";
  if (hours < 48) return `${hours} ຊົ່ວໂມງ`;
  return `${Math.floor(hours / 24)} ວັນ`;
}

/**
 * ຄິດການແຈ້ງເຕືອນເລື່ອງການດຶງຂໍ້ມູນ.
 *
 * ຫຼັກການຈັດລຳດັບ: **ບອກຕົ້ນເຫດກ່ອນ** — ຖ້າ token ໃຊ້ບໍ່ໄດ້ແລ້ວ
 * ບໍ່ຕ້ອງໄປເຕືອນຊ້ຳວ່າ "ຂໍ້ມູນຄ້າງ" ອີກ ເພາະມັນເປັນຜົນຂອງອັນດຽວກັນ
 * ແລະ ການເຕືອນຫຼາຍອັນເລື່ອງດຽວເຮັດໃຫ້ຄົນເລີ່ມບໍ່ອ່ານການເຕືອນ.
 */
export function evaluateSyncHealth(input: SyncHealthInput): Alert[] {
  // ຍັງບໍ່ໄດ້ຕໍ່ Facebook — ປ້ອນມືຢ່າງດຽວກໍ່ໃຊ້ໄດ້ ຈຶ່ງບໍ່ມີຫຍັງຜິດປົກກະຕິ
  if (!input.connected) return [];

  const alerts: Alert[] = [];
  const { token, now } = input;
  const tokenBroken = token.valid === false;

  // 1) token ໃຊ້ບໍ່ໄດ້ແລ້ວ — ຕົ້ນເຫດຂອງທຸກຢ່າງ
  if (tokenBroken) {
    alerts.push({
      id: "token-invalid",
      severity: "critical",
      category: "ການເຊື່ອມຕໍ່",
      title: "Facebook token ໃຊ້ບໍ່ໄດ້ແລ້ວ",
      detail:
        `${token.error ?? "Facebook ປະຕິເສດ token ນີ້"} — ` +
        "ຂໍ້ມູນຈະຢຸດອັບເດດຈົນກວ່າຈະໃສ່ token ໃໝ່ຢູ່ໜ້າຕັ້ງຄ່າ",
      href: "/settings",
    });
  } else if (token.expiresAt) {
    // 2) ຍັງໃຊ້ໄດ້ ແຕ່ໃກ້ຈະໝົດ — ເຕືອນລ່ວງໜ້າໃຫ້ທັນຕໍ່ອາຍຸ
    const left = token.expiresAt.getTime() - now.getTime();
    if (left <= 0) {
      alerts.push({
        id: "token-expired",
        severity: "critical",
        category: "ການເຊື່ອມຕໍ່",
        title: "Facebook token ໝົດອາຍຸແລ້ວ",
        detail:
          `ໝົດອາຍຸແລ້ວຕັ້ງແຕ່ ${formatTimeLao(token.expiresAt)} — ` +
          "ສ້າງ token ໃໝ່ແລ້ວໃສ່ຢູ່ໜ້າຕັ້ງຄ່າ",
        href: "/settings",
      });
    } else if (left <= TOKEN_EXPIRY_WARN_DAYS * DAY_MS) {
      const days = Math.max(1, Math.ceil(left / DAY_MS));
      alerts.push({
        id: "token-expiring",
        severity: days <= 2 ? "serious" : "warning",
        category: "ການເຊື່ອມຕໍ່",
        title: `Facebook token ຈະໝົດອາຍຸໃນ ${days} ວັນ`,
        detail:
          `ໝົດວັນທີ່ ${formatTimeLao(token.expiresAt)} — ` +
          "ຕໍ່ອາຍຸກ່ອນ ບໍ່ດັ່ງນັ້ນການດຶງຈະຢຸດເອງໂດຍບໍ່ມີໃຜຮູ້",
        href: "/settings",
      });
    }
  }

  // 3) ຮອບດຶງຫຼ້າສຸດລົ້ມເຫຼວ — ບອກເຫດຜົນທີ່ Facebook ຄືນມາ
  //    (token ພັງແລ້ວບໍ່ຕ້ອງເວົ້າຊ້ຳ — ຂໍ້ 1 ບອກໄປແລ້ວ)
  if (!tokenBroken && input.lastSync?.status === "FAILED") {
    alerts.push({
      id: "sync-failed",
      severity: "serious",
      category: "ການດຶງຂໍ້ມູນ",
      title: "ການດຶງຂໍ້ມູນຄັ້ງຫຼ້າສຸດລົ້ມເຫຼວ",
      detail:
        `${input.lastSync.message ?? "ບໍ່ຮູ້ສາເຫດ"} — ` +
        `ລອງກົດ “ດຶງຂໍ້ມູນດຽວນີ້” ຢູ່ໜ້າຕັ້ງຄ່າ`,
      href: "/settings",
    });
  }

  // 4) ຂໍ້ມູນຄ້າງ — ກວດສະເພາະຕອນເປີດການດຶງອັດຕະໂນມັດໄວ້
  //    ຖ້າມີວຽກກຳລັງແລ່ນຢູ່ ໃຫ້ລໍມັນຈົບກ່ອນ (ການດຶງຍ້ອນຫຼັງຄັ້ງທຳອິດໃຊ້ເວລາດົນ)
  const busy = input.lastSync?.status === "RUNNING";
  if (input.autoSyncEnabled && !tokenBroken && !busy) {
    if (!input.lastSuccessAt) {
      alerts.push({
        id: "sync-never",
        severity: "serious",
        category: "ການດຶງຂໍ້ມູນ",
        title: "ຍັງບໍ່ເຄີຍດຶງຂໍ້ມູນສຳເລັດຈັກເທື່ອ",
        detail:
          "ເປີດການດຶງອັດຕະໂນມັດໄວ້ແລ້ວ ແຕ່ຍັງບໍ່ມີຮອບໃດສຳເລັດ — " +
          "ກວດ token ແລະ ສິດຂອງບັນຊີໂຄສະນາຢູ່ໜ້າຕັ້ງຄ່າ",
        href: "/settings",
      });
    } else {
      const stale = input.now.getTime() - input.lastSuccessAt.getTime();
      if (stale > input.staleHours * HOUR_MS) {
        alerts.push({
          id: "sync-stale",
          severity: "critical",
          category: "ການດຶງຂໍ້ມູນ",
          title: `ຂໍ້ມູນຄ້າງມາ ${describeSpan(stale)}`,
          detail:
            `ດຶງສຳເລັດຄັ້ງສຸດທ້າຍ ${formatTimeLao(input.lastSuccessAt)} — ` +
            "ຕົວເລກທີ່ເຫັນຢູ່ໜ້າຈໍບໍ່ແມ່ນຂອງຫຼ້າສຸດ ຢ່າຫາກໍ່ຕັດສິນໃຈຈາກມັນ",
          href: "/settings",
        });
      }
    }
  }

  // 5) ດຶງກ່ອງຂໍ້ຄວາມບໍ່ໄດ້ — ຄົນທັກມາແລ້ວເຮົາບໍ່ເຫັນ ຄືເສຍລູກຄ້າຊື່ໆ
  if (input.inboxEnabled && input.inboxError && !tokenBroken) {
    alerts.push({
      id: "inbox-error",
      severity: "serious",
      category: "ກ່ອງຂໍ້ຄວາມ",
      title: "ດຶງ comment / ແຊັດ ບໍ່ໄດ້",
      detail: `${input.inboxError} — ຂໍ້ຄວາມໃໝ່ຈະບໍ່ຂຶ້ນມາໃນກ່ອງ`,
      href: "/fb-pages",
    });
  }

  return alerts;
}

// ------------------------------------------------------- ອັດຕາແລກປ່ຽນທີ່ຂາດ

/** 1 ວັນ ຕໍ່ 1 ສະກຸນ ທີ່ມີຄ່າໂຄສະນາເກີດຂຶ້ນ */
export type SpendDay = { date: string; currency: string };

/**
 * ຫາວັນທີ່ໃຊ້ເງິນຈິງ ແຕ່ບໍ່ໄດ້ປ້ອນອັດຕາແລກປ່ຽນ.
 *
 * ສຳຄັນເພາະ `fxRateFor()` ຕົກໄປໃຊ້ `defaultFxRateToLak` ຢ່າງງຽບໆ —
 * ຄ່າກີບທີ່ບັນທຶກໄວ້ຈຶ່ງເພື້ອນຈາກຄວາມຈິງໂດຍບໍ່ມີສັນຍານຫຍັງເລີຍ.
 */
export function missingFxDays(
  spendDays: SpendDay[],
  haveRates: SpendDay[],
): SpendDay[] {
  const have = new Set(haveRates.map((r) => `${r.date}|${r.currency}`));
  return spendDays
    .filter((d) => d.currency !== "LAK" && !have.has(`${d.date}|${d.currency}`))
    .sort((a, b) => a.date.localeCompare(b.date) || a.currency.localeCompare(b.currency));
}

/** ແປງວັນທີ່ຂາດອັດຕາ ໃຫ້ເປັນການແຈ້ງເຕືອນ (ວ່າງ = ບໍ່ມີຫຍັງຂາດ) */
export function fxGapAlert(missing: SpendDay[]): Alert | null {
  if (missing.length === 0) return null;

  const currencies = [...new Set(missing.map((d) => d.currency))].join(", ");
  const first = missing[0].date;
  const last = missing[missing.length - 1].date;
  const span =
    first === last
      ? `ວັນທີ່ ${formatDateLao(first)}`
      : `${formatDateLao(first)} ຫາ ${formatDateLao(last)}`;

  return {
    id: "fx-missing",
    severity: missing.length >= 7 ? "serious" : "warning",
    category: "ຂໍ້ມູນ",
    title: `${missing.length} ວັນ ຍັງບໍ່ໄດ້ປ້ອນອັດຕາແລກປ່ຽນ`,
    detail:
      `${span} ມີຄ່າໂຄສະນາເປັນ ${currencies} ແຕ່ບໍ່ມີອັດຕາຂອງວັນນັ້ນ — ` +
      "ລະບົບໃຊ້ອັດຕາຕັ້ງຕົ້ນແທນ ຍອດກີບຈຶ່ງອາດເພື້ອນຈາກຄວາມຈິງ",
    href: "/settings#fx",
  };
}
