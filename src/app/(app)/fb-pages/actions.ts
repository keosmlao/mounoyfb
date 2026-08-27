"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth-server";
import { recordAudit } from "@/lib/audit";
import { bool, enumVal, reqStr, str } from "@/lib/form";
import { EntityStatus } from "@/generated/prisma/enums";

const STATUSES = Object.values(EntityStatus);

function readForm(fd: FormData) {
  return {
    name: reqStr(fd, "name", "ຊື່ເພຈ"),
    fbPageId: str(fd, "fbPageId"),
    category: str(fd, "category"),
    status: enumVal(fd, "status", STATUSES, EntityStatus.ACTIVE),
    note: str(fd, "note"),
    // ປິດໄວ້ໄດ້ສຳລັບເພຈທີ່ບໍ່ຢາກໃຫ້ດຶງ comment/ແຊັດ
    inboxOn: bool(fd, "inboxOn"),
  };
}

export async function createFbPage(fd: FormData) {
  await requireSession();
  await prisma.fbPage.create({ data: readForm(fd) });
  revalidatePath("/fb-pages");
  redirect("/fb-pages");
}

export async function updateFbPage(id: string, fd: FormData) {
  await requireSession();
  await prisma.fbPage.update({ where: { id }, data: readForm(fd) });
  revalidatePath("/fb-pages");
  redirect("/fb-pages");
}

export async function deleteFbPage(id: string) {
  await requireSession();
  const removed = await prisma.fbPage.delete({ where: { id } });
  await recordAudit("fbpage.delete", removed.name);
  revalidatePath("/fb-pages");
  redirect("/fb-pages");
}
