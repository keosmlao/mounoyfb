"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth-server";
import { date, enumVal, num, reqStr, str } from "@/lib/form";
import { CampaignObjective, EntityStatus } from "@/generated/prisma/enums";

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

export async function updateCampaign(id: string, fd: FormData) {
  await requireSession();
  await prisma.campaign.update({ where: { id }, data: readCampaign(fd) });
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${id}`);
  redirect(`/campaigns/${id}`);
}

export async function deleteCampaign(id: string) {
  await requireSession();
  await prisma.campaign.delete({ where: { id } });
  revalidatePath("/campaigns");
  redirect("/campaigns");
}

/** ປ່ຽນສະຖານະໄວຈາກໜ້າລາຍການ (ຢຸດ / ຍິງຕໍ່) */
export async function toggleCampaignStatus(id: string, next: EntityStatus) {
  await requireSession();
  await prisma.campaign.update({ where: { id }, data: { status: next } });
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${id}`);
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
  revalidatePath(`/ad-sets/${ad.adSetId}`);
  redirect(`/ad-sets/${ad.adSetId}`);
}
