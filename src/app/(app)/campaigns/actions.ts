"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth-server";
import { recordAudit } from "@/lib/audit";
import { date, enumVal, num, reqStr, str } from "@/lib/form";
import { CampaignObjective, EntityStatus } from "@/generated/prisma/enums";
import {
  explainFbError,
  getFbConfig,
  setFbRunStatus,
  updateFbCampaign,
  type FbCampaignEdit,
} from "@/lib/fb";

const STATUSES = Object.values(EntityStatus);
const OBJECTIVES = Object.values(CampaignObjective);

// ---------------------------------------------------------------- Campaign

function readCampaign(fd: FormData) {
  return {
    name: reqStr(fd, "name", "ຊື່ແຄມເປນ"),
    adAccountId: reqStr(fd, "adAccountId", "ບັນຊີໂຄສະນາ"),
    pageId: str(fd, "pageId"),
    productId: str(fd, "productId"),
    fbCampaignId: str(fd, "fbCampaignId"),
    objective: enumVal(fd, "objective", OBJECTIVES, CampaignObjective.MESSAGES),
    status: enumVal(fd, "status", STATUSES, EntityStatus.ACTIVE),
    buyingType: str(fd, "buyingType") ?? "AUCTION",
    dailyBudget: num(fd, "dailyBudget"),
    lifetimeBudget: num(fd, "lifetimeBudget"),
    startDate: date(fd, "startDate"),
    endDate: date(fd, "endDate"),
    ownerName: str(fd, "ownerName"),
    note: str(fd, "note"),
  };
}

export async function createCampaign(fd: FormData) {
  await requireSession();
  const campaign = await prisma.campaign.create({ data: readCampaign(fd) });
  revalidatePath("/campaigns");
  redirect(`/campaigns/${campaign.id}`);
}

/**
 * ບັນທຶກການແກ້ໄຂແຄມເປນ.
 *
 * ສຳລັບແຄມເປນທີ່ຜູກກັບ Facebook ຊ່ອງຕ່າງໆແບ່ງເປັນ 3 ພວກ:
 *
 * 1. **ສົ່ງໄປ Facebook** (ຊື່, ງົບຕໍ່ວັນ, ງົບລວມ) — ສົ່ງກ່ອນ ຖ້າ Facebook
 *    ປະຕິເສດຈະບໍ່ບັນທຶກຫຍັງເລີຍ. ບໍ່ດັ່ງນັ້ນໜ້າຈໍຈະບອກງົບໃໝ່ ທັງທີ່
 *    Facebook ຍັງຕັດເງິນຕາມງົບເກົ່າ ແລ້ວຮອບ sync ຖັດໄປກໍ່ທັບຄ່າເຮົາຖິ້ມ.
 * 2. **Facebook ເປັນເຈົ້າຂອງ ແຕ່ແກ້ບໍ່ໄດ້** (ເປົ້າໝາຍ, ວັນເລີ່ມ/ຈົບ, ສະຖານະ) —
 *    ບໍ່ຮັບຄ່າຈາກຟອມ ໃຊ້ຄ່າເກົ່າຕໍ່. ຟອມລັອກໄວ້ຢູ່ແລ້ວ ແຕ່ຢ່າເຊື່ອຟອມ.
 *    (ຢຸດ/ຍິງຕໍ່ ໃຊ້ປຸ່ມ `RunToggle` ຊຶ່ງສັ່ງໄປ Facebook ໃຫ້ຖືກຕ້ອງ)
 * 3. **ຂອງລະບົບເຮົາເອງ** (ຜູ້ຮັບຜິດຊອບ, ໝາຍເຫດ, ເພຈ, ສິນຄ້າ) — ບັນທຶກປົກກະຕິ
 *    ເພາະຮອບ sync ບໍ່ໄດ້ແຕະຊ່ອງເຫຼົ່ານີ້.
 */
export async function updateCampaign(id: string, fd: FormData) {
  await requireSession();

  const existing = await prisma.campaign.findUnique({
    where: { id },
    select: {
      fbCampaignId: true,
      name: true,
      dailyBudget: true,
      lifetimeBudget: true,
      objective: true,
      status: true,
      startDate: true,
      endDate: true,
      adAccount: { select: { currency: true } },
    },
  });
  if (!existing) throw new Error("ບໍ່ພົບແຄມເປນນີ້ແລ້ວ");

  const input = readCampaign(fd);

  if (existing.fbCampaignId) {
    // ພວກທີ 2 — ຮັກສາຄ່າເກົ່າໄວ້
    input.objective = existing.objective;
    input.status = existing.status;
    input.startDate = existing.startDate;
    input.endDate = existing.endDate;

    // ພວກທີ 1 — ສົ່ງສະເພາະອັນທີ່ປ່ຽນຈິງ
    const push: FbCampaignEdit = {};
    if (input.name !== existing.name) push.name = input.name;
    if (input.dailyBudget !== existing.dailyBudget) {
      push.dailyBudget = input.dailyBudget;
    }
    if (input.lifetimeBudget !== existing.lifetimeBudget) {
      push.lifetimeBudget = input.lifetimeBudget;
    }

    if (Object.keys(push).length > 0) {
      if (!(await getFbConfig())) {
        throw new Error(
          "ແຄມເປນນີ້ຜູກກັບ Facebook — ຕ້ອງໃສ່ access token ຢູ່ໜ້າຕັ້ງຄ່າກ່ອນ ຈຶ່ງແກ້ຊື່ ຫຼື ງົບໄດ້",
        );
      }
      try {
        await updateFbCampaign(
          existing.fbCampaignId,
          push,
          existing.adAccount.currency,
        );
      } catch (error) {
        throw new Error(explainFbError(error));
      }
    }
  }

  await prisma.campaign.update({ where: { id }, data: input });
  if (existing.fbCampaignId) {
    await recordAudit(
      "campaign.update",
      input.name,
      `ງົບ/ວັນ: ${existing.dailyBudget ?? "—"} → ${input.dailyBudget ?? "—"}`,
    );
  }
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${id}`);
  redirect(`/campaigns/${id}`);
}

export async function deleteCampaign(id: string) {
  await requireSession();
  const campaign = await prisma.campaign.delete({ where: { id } });
  await recordAudit(
    "campaign.delete",
    campaign.name,
    "ລຶບພ້ອມຊຸດ, ໂຄສະນາ ແລະ ຜົນລາຍວັນທັງໝົດ",
  );
  revalidatePath("/campaigns");
  redirect("/campaigns");
}

/**
 * ຢຸດ / ໃຫ້ຍິງຕໍ່ ແຄມເປນ.
 *
 * ແຄມເປນທີ່ຜູກກັບ Facebook (ມີ `fbCampaignId`) ຈະຖືກສັ່ງໄປ Facebook **ກ່ອນ**
 * ແລ້ວຈຶ່ງບັນທຶກລົງຖານຂໍ້ມູນ — ຖ້າ Facebook ປະຕິເສດ (ເຊັ່ນ token ຂາດສິດ
 * `ads_management`) ຈະ throw ອອກໄປ ແລະ ສະຖານະໃນລະບົບບໍ່ຖືກປ່ຽນ
 * ເພື່ອບໍ່ໃຫ້ໜ້າຈໍບອກວ່າ “ຢຸດແລ້ວ” ທັງທີ່ຄວາມຈິງຍັງຍິງເງິນຢູ່.
 *
 * ແຄມເປນທີ່ປ້ອນມື (ບໍ່ມີ `fbCampaignId`) ປ່ຽນສະເພາະໃນລະບົບເຮົາ.
 */
export async function toggleCampaignStatus(id: string, next: EntityStatus) {
  await requireSession();

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: { fbCampaignId: true, name: true },
  });
  if (!campaign) throw new Error("ບໍ່ພົບແຄມເປນນີ້ແລ້ວ");
  const campaignName = campaign.name;

  // ສະເພາະ ຢຸດ/ຍິງຕໍ່ ເທົ່ານັ້ນທີ່ Facebook ຮັບ — ສະຖານະອື່ນເປັນຂອງລະບົບເຮົາເອງ
  const runStatus =
    next === EntityStatus.ACTIVE
      ? "ACTIVE"
      : next === EntityStatus.PAUSED
        ? "PAUSED"
        : null;

  if (campaign.fbCampaignId && runStatus && (await getFbConfig())) {
    await setFbRunStatus(campaign.fbCampaignId, runStatus);
  }

  await prisma.campaign.update({ where: { id }, data: { status: next } });
  await recordAudit(
    "campaign.status",
    campaignName,
    campaign.fbCampaignId ? `${next} (ສັ່ງໄປ Facebook ນຳ)` : String(next),
  );
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${id}`);
  revalidatePath("/");
}

/**
 * ໃຊ້ກັບປຸ່ມ `RunToggle` — ຄືນ **ຂໍ້ຄວາມຜິດພາດ** ແທນທີ່ຈະ throw
 * ເພື່ອໃຫ້ໜ້າຈໍສະແດງສາເຫດໄດ້ ໂດຍບໍ່ພັງທັງໜ້າ.
 */
export async function toggleCampaignStatusSafe(
  id: string,
  next: EntityStatus,
  _prev: string | null,
  _fd: FormData,
): Promise<string | null> {
  try {
    await toggleCampaignStatus(id, next);
    return null;
  } catch (error) {
    return explainFbError(error);
  }
}

// ------------------------------------------------------------------ AdSet

function readAdSet(fd: FormData) {
  return {
    name: reqStr(fd, "name", "ຊື່ຊຸດໂຄສະນາ"),
    fbAdSetId: str(fd, "fbAdSetId"),
    status: enumVal(fd, "status", STATUSES, EntityStatus.ACTIVE),
    dailyBudget: num(fd, "dailyBudget"),
    lifetimeBudget: num(fd, "lifetimeBudget"),
    bidAmount: num(fd, "bidAmount"),
    optimizationGoal: str(fd, "optimizationGoal"),
    billingEvent: str(fd, "billingEvent"),
    audience: str(fd, "audience"),
    placements: str(fd, "placements"),
    startDate: date(fd, "startDate"),
    endDate: date(fd, "endDate"),
    note: str(fd, "note"),
  };
}

export async function createAdSet(campaignId: string, fd: FormData) {
  await requireSession();
  await prisma.adSet.create({ data: { ...readAdSet(fd), campaignId } });
  revalidatePath(`/campaigns/${campaignId}`);
  redirect(`/campaigns/${campaignId}`);
}

export async function updateAdSet(id: string, fd: FormData) {
  await requireSession();
  const adSet = await prisma.adSet.update({
    where: { id },
    data: readAdSet(fd),
  });
  revalidatePath(`/ad-sets/${id}`);
  revalidatePath(`/campaigns/${adSet.campaignId}`);
  redirect(`/ad-sets/${id}`);
}

export async function deleteAdSet(id: string) {
  await requireSession();
  const adSet = await prisma.adSet.delete({ where: { id } });
  await recordAudit("adset.delete", adSet.name);
  revalidatePath(`/campaigns/${adSet.campaignId}`);
  redirect(`/campaigns/${adSet.campaignId}`);
}

// --------------------------------------------------------------------- Ad

function readAd(fd: FormData) {
  return {
    name: reqStr(fd, "name", "ຊື່ໂຄສະນາ"),
    fbAdId: str(fd, "fbAdId"),
    status: enumVal(fd, "status", STATUSES, EntityStatus.ACTIVE),
    creativeType: str(fd, "creativeType"),
    creativeUrl: str(fd, "creativeUrl"),
    postUrl: str(fd, "postUrl"),
    headline: str(fd, "headline"),
    primaryText: str(fd, "primaryText"),
    callToAction: str(fd, "callToAction"),
    note: str(fd, "note"),
  };
}

export async function createAd(adSetId: string, fd: FormData) {
  await requireSession();
  await prisma.ad.create({ data: { ...readAd(fd), adSetId } });
  revalidatePath(`/ad-sets/${adSetId}`);
  redirect(`/ad-sets/${adSetId}`);
}

export async function updateAd(id: string, fd: FormData) {
  await requireSession();
  const ad = await prisma.ad.update({ where: { id }, data: readAd(fd) });
  revalidatePath(`/ad-sets/${ad.adSetId}`);
  redirect(`/ad-sets/${ad.adSetId}`);
}

export async function deleteAd(id: string) {
  await requireSession();
  const ad = await prisma.ad.delete({ where: { id } });
  await recordAudit("ad.delete", ad.name);
  revalidatePath(`/ad-sets/${ad.adSetId}`);
  redirect(`/ad-sets/${ad.adSetId}`);
}
