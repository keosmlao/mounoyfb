import { safeDiv } from "./format";

/**
 * ການຊຳລະຄ່າໂຄສະນາ — ແຍກ **ຈ່າຍແລ້ວ** ອອກຈາກ **ຄ້າງຊຳລະ** ເພື່ອວາງແຜນຈ່າຍ.
 *
 * ຕົວເລກທັງໝົດມາຈາກ Facebook (`AdAccount.fb*`) ບໍ່ແມ່ນຂອງເຮົາເອງ:
 *
 * - `balance` = ຍອດທີ່ໃຊ້ໄປແລ້ວ **ແຕ່ຍັງບໍ່ທັນຖືກຮຽກເກັບ** → ຄືເງິນທີ່ຕ້ອງກຽມ
 * - `amountSpent` = ໃຊ້ໄປທັງໝົດຕັ້ງແຕ່ເປີດບັນຊີ
 * - ຈຶ່ງໄດ້ **ຈ່າຍແລ້ວ = amountSpent − balance**
 *
 * ⚠️ ສູດນີ້ຖືກກັບບັນຊີທີ່ຕັດຜ່ານບັດ/ໃບບິນ (ຈ່າຍທີຫຼັງ) ເຊິ່ງເປັນແບບປົກກະຕິ.
 * ບັນຊີແບບ**ເຕີມເງິນລ່ວງໜ້າ** Facebook ໃຊ້ຄຳວ່າ balance ຄົນລະຄວາມໝາຍ —
 * ໜ້າຈໍຈຶ່ງຕ້ອງບອກສະເໝີວ່າຕົວເລກຄິດມາຈາກຫຍັງ ໃຫ້ຄົນກວດຄືນໄດ້.
 *
 * ⚠️ ຫ້າມບວກເງິນຂ້າມບັນຊີທີ່ຄົນລະສະກຸນ — ຕ້ອງແປງເປັນກີບກ່ອນ
 * ດ້ວຍອັດຕາທີ່ບັນຊີນັ້ນ**ໃຊ້ຈິງ** (ໄດ້ຈາກ `spendLak ÷ spend` ຂອງ Insight)
 * ບໍ່ແມ່ນອັດຕາທົ່ວໄປ — ເບິ່ງ `AGENTS.md`.
 *
 * ໄຟລ໌ນີ້ຕ້ອງບໍລິສຸດ (ຫ້າມ import prisma) ແລະ ມີ test ຄຸມ.
 */

/** ຂໍ້ມູນດິບ 1 ບັນຊີ ທີ່ໜ້າຈໍອ່ານມາໃຫ້ */
export type AccountBilling = {
  id: string;
  name: string;
  /** ສະກຸນທີ່ Facebook ຕັດຈາກບັນຊີນີ້ */
  currency: string;
  fbAccountId: string | null;
  fundingSource: string | null;
  /** ຍອດຄ້າງຊຳລະ (ສະກຸນບັນຊີ) — null = ຍັງບໍ່ເຄີຍດຶງ */
  balance: number | null;
  /** ໃຊ້ໄປທັງໝົດຕັ້ງແຕ່ເປີດບັນຊີ (ສະກຸນບັນຊີ) */
  amountSpent: number | null;
  /** ເພດານທີ່ຕັ້ງຢູ່ Facebook (0 = ບໍ່ໄດ້ຕັ້ງ) */
  spendCap: number | null;
  /** ເວລາທີ່ດຶງຂໍ້ມູນການຊຳລະຄັ້ງລ້າສຸດ */
  billingAt: Date | null;
  /** ຄ່າໂຄສະນາໃນຊ່ວງທີ່ໃຊ້ຄິດຄ່າສະເລ່ຍຕໍ່ມື້ (ກີບ) */
  recentSpendLak: number;
  /** ຈຳນວນວັນຂອງຊ່ວງນັ້ນ */
  recentDays: number;
  /** ຄ່າໂຄສະນາທັງໝົດຕາມ Insight — ໃຊ້ຫາອັດຕາແລກປ່ຽນທີ່ບັນຊີນີ້ໃຊ້ຈິງ */
  insightSpend: number;
  insightSpendLak: number;
};

export type BillingRow = AccountBilling & {
  /** ອັດຕາທີ່ໃຊ້ແປງເປັນກີບ (ຂອງບັນຊີນີ້) */
  fxRate: number;
  /** ຄ້າງຊຳລະເປັນກີບ */
  dueLak: number;
  /** ຈ່າຍແລ້ວ (ສະກຸນບັນຊີ) — null ຖ້າຂໍ້ມູນບໍ່ພໍ */
  paid: number | null;
  paidLak: number;
  /** ຄ່າໂຄສະນາສະເລ່ຍຕໍ່ມື້ (ກີບ) */
  dailyLak: number;
  /** ຄາດວ່າຍອດຄ້າງຈະເປັນເທົ່າໃດໃນອີກ 7 ມື້ (ກີບ) */
  forecast7Lak: number;
  /** ເຫຼືອອີກຈັກມື້ຈຶ່ງຮອດເພດານຂອງ Facebook — null = ບໍ່ໄດ້ຕັ້ງ ຫຼື ຄິດບໍ່ໄດ້ */
  daysToCap: number | null;
  /** ຍັງບໍ່ເຄີຍດຶງຂໍ້ມູນການຊຳລະ */
  missing: boolean;
  /** ດຶງມາດົນແລ້ວ — ຕົວເລກອາດເກົ່າ */
  stale: boolean;
};

export type BillingSummary = {
  rows: BillingRow[];
  /** ເງິນທີ່ຕ້ອງກຽມດຽວນີ້ (ກີບ) */
  dueLak: number;
  /** ຄາດວ່າຈະຕ້ອງກຽມໃນອີກ 7 ມື້ (ກີບ) */
  forecast7Lak: number;
  /** ຈ່າຍໄປແລ້ວທັງໝົດ (ກີບ) */
  paidLak: number;
  /** ຈຳນວນບັນຊີທີ່ມີຍອດຄ້າງ */
  owing: number;
  /** ບັນຊີທີ່ຍັງບໍ່ເຄີຍດຶງຂໍ້ມູນການຊຳລະ */
  missing: number;
  /** ຂໍ້ມູນເກົ່າສຸດທີ່ໃຊ້ຢູ່ — null = ບໍ່ມີບັນຊີໃດເຄີຍດຶງ */
  oldestAt: Date | null;
};

/** ດຶງມາເກີນເທົ່ານີ້ຖືວ່າຕົວເລກເກົ່າ — ຮອບດຶງອັດຕະໂນມັດແລ່ນຖີ່ກວ່ານີ້ຫຼາຍ */
export const STALE_HOURS = 24;

/** ຈຳນວນມື້ທີ່ຄາດການລ່ວງໜ້າ — ພໍໃຫ້ວາງແຜນຈ່າຍປະຈຳອາທິດ */
export const FORECAST_DAYS = 7;

/**
 * ອັດຕາແລກປ່ຽນທີ່ບັນຊີນີ້ໃຊ້ຈິງ — ຄິດຈາກຜົນລາຍວັນທີ່ບັນທຶກໄວ້ແລ້ວ
 * (`spendLak ÷ spend`) ຈຶ່ງກົງກັບຕົວເລກທີ່ໜ້າອື່ນສະແດງ.
 * ບໍ່ມີຂໍ້ມູນ (ບັນຊີໃໝ່) ຈຶ່ງຕົກມາໃຊ້ອັດຕາທົ່ວໄປ.
 */
export function effectiveFxRate(
  account: Pick<AccountBilling, "currency" | "insightSpend" | "insightSpendLak">,
  fallbackRate: number,
): number {
  if (account.currency === "LAK") return 1;
  const rate = safeDiv(account.insightSpendLak, account.insightSpend);
  return rate > 0 ? rate : fallbackRate;
}

function toRow(
  account: AccountBilling,
  fallbackRate: number,
  now: Date,
): BillingRow {
  const fxRate = effectiveFxRate(account, fallbackRate);
  const missing = account.billingAt === null || account.balance === null;

  const due = Math.max(0, account.balance ?? 0);
  const dueLak = due * fxRate;

  // ຈ່າຍແລ້ວ = ໃຊ້ໄປທັງໝົດ − ຍອດຄ້າງ (ຕິດລົບບໍ່ໄດ້)
  const paid =
    account.amountSpent === null || account.balance === null
      ? null
      : Math.max(0, account.amountSpent - account.balance);

  const dailyLak = safeDiv(account.recentSpendLak, account.recentDays);

  // ເພດານເປັນຕົວເລກ**ສະສົມທັງຊີວິດບັນຊີ** ຈຶ່ງທຽບກັບ amountSpent ບໍ່ແມ່ນ balance
  let daysToCap: number | null = null;
  if (
    account.spendCap !== null &&
    account.spendCap > 0 &&
    account.amountSpent !== null &&
    dailyLak > 0
  ) {
    const leftLak = Math.max(0, account.spendCap - account.amountSpent) * fxRate;
    daysToCap = Math.floor(leftLak / dailyLak);
  }

  const staleAfter = STALE_HOURS * 60 * 60 * 1000;

  return {
    ...account,
    fxRate,
    dueLak,
    paid,
    paidLak: (paid ?? 0) * fxRate,
    dailyLak,
    // ບໍ່ຮູ້ຍອດຄ້າງ = ຄາດການບໍ່ໄດ້. ເອົາຄ່າໃຊ້ຈ່າຍລາຍມື້ມາຄາດເສີຍໆ
    // ຈະໄດ້ຕົວເລກທີ່ເບິ່ງຄືໜ້າເຊື່ອ ແຕ່ຂາດຄ່າຄ້າງເກົ່າໄປທັງກ້ອນ
    forecast7Lak: missing ? 0 : dueLak + dailyLak * FORECAST_DAYS,
    daysToCap,
    missing,
    stale:
      account.billingAt !== null &&
      now.getTime() - account.billingAt.getTime() > staleAfter,
  };
}

/**
 * ລວມທຸກບັນຊີເປັນພາບດຽວ — ຮຽງບັນຊີທີ່ຄ້າງຫຼາຍສຸດຂຶ້ນກ່ອນ
 * ເພາະນັ້ນຄືອັນທີ່ຕ້ອງຫາເງິນມາຈ່າຍກ່ອນ.
 */
export function buildBillingSummary(
  accounts: AccountBilling[],
  fallbackRate: number,
  now: Date = new Date(),
): BillingSummary {
  const rows = accounts
    .map((a) => toRow(a, fallbackRate, now))
    .sort((a, b) => b.dueLak - a.dueLak);

  let oldestAt: Date | null = null;
  for (const r of rows) {
    if (!r.billingAt) continue;
    if (!oldestAt || r.billingAt < oldestAt) oldestAt = r.billingAt;
  }

  return {
    rows,
    dueLak: rows.reduce((sum, r) => sum + r.dueLak, 0),
    forecast7Lak: rows.reduce((sum, r) => sum + r.forecast7Lak, 0),
    paidLak: rows.reduce((sum, r) => sum + r.paidLak, 0),
    owing: rows.filter((r) => r.dueLak > 0).length,
    missing: rows.filter((r) => r.missing).length,
    oldestAt,
  };
}
