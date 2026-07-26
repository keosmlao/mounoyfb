"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { bool, num, reqDate, reqStr, str } from "@/lib/form";
import { resolveRange } from "@/lib/date";
import { runSyncWithLog } from "@/lib/fb";
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
  await put("companyName", str(fd, "companyName"));
  await put("defaultFxRateToLak", String(num(fd, "defaultFxRateToLak") ?? 21700));
  await put("fbApiVersion", str(fd, "fbApiVersion"));

  // ປະຊ່ອງ token ວ່າງໄວ້ = ຮັກສາຄ່າເກົ່າ (ບໍ່ໄດ້ສະແດງຄືນເພື່ອຄວາມປອດໄພ)
  const token = str(fd, "fbAccessToken");
  if (token) await put("fbAccessToken", token);
  if (str(fd, "clearToken") === "1") await put("fbAccessToken", null);

  revalidatePath("/settings");
}

export async function saveAlertThresholds(fd: FormData) {
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

/** ດຶງຂໍ້ມູນຈາກ Facebook — ຜົນລັບ (ສຳເລັດ/ຜິດພາດ) ຖືກບັນທຶກໄວ້ໃນ SyncLog */
export async function runFacebookSync(fd: FormData) {
  const range = resolveRange({
    from: str(fd, "from") ?? undefined,
    to: str(fd, "to") ?? undefined,
  });

  const levels = {
    campaign: bool(fd, "levelCampaign"),
    adset: bool(fd, "levelAdset"),
    ad: bool(fd, "levelAd"),
  };
  // ຢ່າງໜ້ອຍຕ້ອງມີ 1 ລະດັບ ບໍ່ດັ່ງນັ້ນການກົດຈະບໍ່ໄດ້ຫຍັງເລີຍ
  if (!levels.campaign && !levels.adset && !levels.ad) levels.campaign = true;

  try {
    await runSyncWithLog(range, levels);
  } catch {
    // ຂໍ້ຄວາມຜິດພາດຖືກເກັບໄວ້ໃນ SyncLog ແລ້ວ ແລະ ສະແດງຢູ່ຕາຕະລາງລຸ່ມໜ້ານີ້
  }

  revalidatePath("/settings");
  revalidatePath("/");
}
