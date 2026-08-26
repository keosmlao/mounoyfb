"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth-server";
import { enumVal, num0, reqDate, reqStr, str } from "@/lib/form";
import { LeadStatus } from "@/generated/prisma/enums";

const STATUSES = Object.values(LeadStatus);

function readForm(fd: FormData) {
  return {
    date: reqDate(fd, "date", "ວັນທີ່"),
    name: reqStr(fd, "name", "ຊື່ລູກຄ້າ"),
    phone: str(fd, "phone"),
    fbName: str(fd, "fbName"),
    channel: str(fd, "channel"),
    status: enumVal(fd, "status", STATUSES, LeadStatus.NEW),
    amount: num0(fd, "amount"),
    assignee: str(fd, "assignee"),
    note: str(fd, "note"),
    campaignId: str(fd, "campaignId"),
    productId: str(fd, "productId"),
  };
}

export async function createLead(fd: FormData) {
  await requireSession();
  await prisma.lead.create({ data: readForm(fd) });
  revalidatePath("/leads");
  redirect("/leads");
}

export async function updateLead(id: string, fd: FormData) {
  await requireSession();
  await prisma.lead.update({ where: { id }, data: readForm(fd) });
  revalidatePath("/leads");
  redirect("/leads");
}

export async function deleteLead(id: string) {
  await requireSession();
  await prisma.lead.delete({ where: { id } });
  revalidatePath("/leads");
  redirect("/leads");
}

/** ປ່ຽນສະຖານະໄວຈາກໜ້າລາຍການ */
export async function setLeadStatus(id: string, fd: FormData) {
  await requireSession();
  const status = enumVal(fd, "status", STATUSES, LeadStatus.NEW);
  await prisma.lead.update({ where: { id }, data: { status } });
  revalidatePath("/leads");
}
