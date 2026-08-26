"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth-server";
import { bool, num, reqDate, reqStr, str } from "@/lib/form";
import { countDays, parseDate, resolveRange } from "@/lib/date";
import {
  fetchFbAssets,
  importFbAssets,
  runSyncJob,
  startSyncLog,
  type FbAssetAccount,
  type FbAssetPage,
} from "@/lib/fb";
import { DEFAULT_THRESHOLDS, THRESHOLD_KEYS } from "@/lib/alerts";

async function put(key: string, value: string | null) {
  if (value === null) {
    await prisma.appSetting.deleteMany({ where: { key } });
    return;
  }
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function saveSettings(fd: FormData) {
  await requireSession();
  await put("companyName", str(fd, "companyName"));
  await put("defaultFxRateToLak", String(num(fd, "defaultFxRateToLak") ?? 21700));
  await put("fbApiVersion", str(fd, "fbApiVersion"));

  // ປະຊ່ອງ token ວ່າງໄວ້ = ຮັກສາຄ່າເກົ່າ (ບໍ່ໄດ້ສະແດງຄືນເພື່ອຄວາມປອດໄພ)
  const token = str(fd, "fbAccessToken");
  if (token) await put("fbAccessToken", token);
  if (str(fd, "clearToken") === "1") await put("fbAccessToken", null);

  revalidatePath("/settings");
}

/** ຜົນການທົດສອບ/ນຳເຂົ້າ ທີ່ສົ່ງກັບໄປໃຫ້ໜ້າຈໍສະແດງ */
export type FbConnectionState = {
  ok: boolean;
  message: string;
  tokenOwner?: string;
  accounts?: FbAssetAccount[];
  pages?: FbAssetPage[];
  pagesError?: string;
} | null;

export async function testFbConnection(): Promise<FbConnectionState> {
  await requireSession();
  try {
    const assets = await fetchFbAssets();
    return {
      ok: true,
      message:
        assets.accounts.length === 0
          ? "ຕໍ່ໄດ້ ແຕ່ບໍ່ພົບບັນຊີໂຄສະນາ — ກວດວ່າໄດ້ assign ບັນຊີໃຫ້ system user ນີ້ແລ້ວບໍ່"
          : `ຕໍ່ໄດ້ — ພົບ ${assets.accounts.length} ບັນຊີໂຄສະນາ ແລະ ${assets.pages.length} ເພຈ`,
      tokenOwner: assets.tokenOwner,
      accounts: assets.accounts,
      pages: assets.pages,
      pagesError: assets.pagesError,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function importFbAssetsAction(): Promise<FbConnectionState> {
  await requireSession();
  try {
    const result = await importFbAssets();
    revalidatePath("/settings");
    revalidatePath("/ad-accounts");
    revalidatePath("/fb-pages");
    return {
      ok: true,
      message: `ນຳເຂົ້າແລ້ວ: ${result.accounts} ບັນຊີໂຄສະນາ, ${result.pages} ເພຈ — ພ້ອມດຶງຜົນລາຍວັນໄດ້`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function saveAlertThresholds(fd: FormData) {
  await requireSession();
  for (const [field, key] of Object.entries(THRESHOLD_KEYS) as [
    keyof typeof THRESHOLD_KEYS,
    string,
  ][]) {
    const value = num(fd, field);
    await put(key, String(value ?? DEFAULT_THRESHOLDS[field]));
  }
  revalidatePath("/settings");
  revalidatePath("/alerts");
  revalidatePath("/");
}

export async function saveExchangeRate(fd: FormData) {
  await requireSession();
  const date = reqDate(fd, "date", "ວັນທີ່");
  const currency = reqStr(fd, "currency", "ສະກຸນເງິນ");
  const rateToLak = num(fd, "rateToLak") ?? 0;
  if (rateToLak <= 0) throw new Error("ອັດຕາແລກປ່ຽນຕ້ອງຫຼາຍກວ່າ 0");

  await prisma.exchangeRate.upsert({
    where: { date_currency: { date, currency } },
    create: { date, currency, rateToLak },
    update: { rateToLak },
  });

  revalidatePath("/settings");
}

/**
 * ເລີ່ມການດຶງຂໍ້ມູນຈາກ Facebook — ຄືນທັນທີ ບໍ່ລໍໃຫ້ດຶງຈົບ.
 * ວຽກຈິງແລ່ນເບື້ອງຫຼັງດ້ວຍ `after()` ເພື່ອໃຫ້ request ຕອບກັບທັນທີ.
 * ການ deploy ຕ້ອງໃຫ້ process/invocation ມີເວລາພໍຈົນ callback ແລ່ນຈົບ.
 * ຄວາມຄືບໜ້າ ແລະ ຜົນລັບຢູ່ໃນ SyncLog ຊຶ່ງໜ້າຕັ້ງຄ່າດຶງໄປສະແດງ.
 */
export async function runFacebookSync(fd: FormData) {
  await requireSession();
  const range = resolveRange({
    from: str(fd, "from") ?? undefined,
    to: str(fd, "to") ?? undefined,
  });
  if (countDays(range) > 366) {
    throw new Error("ການ sync 1 ຄັ້ງເລືອກໄດ້ສູງສຸດ 366 ວັນ");
  }

  const levels = {
    campaign: bool(fd, "levelCampaign"),
    adset: bool(fd, "levelAdset"),
    ad: bool(fd, "levelAd"),
  };
  // ຢ່າງໜ້ອຍຕ້ອງມີ 1 ລະດັບ ບໍ່ດັ່ງນັ້ນການກົດຈະບໍ່ໄດ້ຫຍັງເລີຍ
  if (!levels.campaign && !levels.adset && !levels.ad) levels.campaign = true;

  try {
    const log = await startSyncLog(range, levels);
    // ແລ່ນຫຼັງຈາກຕອບໜ້າຈໍໄປແລ້ວ — runSyncJob ຈັດການ error ເອງລົງ SyncLog
    after(() => runSyncJob(log.id, range, levels));
  } catch (error) {
    // ເລີ່ມບໍ່ໄດ້ (ເຊັ່ນ ມີວຽກແລ່ນຢູ່ແລ້ວ) — ບັນທຶກໄວ້ໃຫ້ເຫັນໃນປະຫວັດ
    await prisma.syncLog.create({
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        level: "campaign",
        dateFrom: parseDate(range.from),
        dateTo: parseDate(range.to),
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }

  revalidatePath("/settings");
}
