"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth-server";
import { recordAudit } from "@/lib/audit";
import { num, reqStr, str } from "@/lib/form";
import { enumVal } from "@/lib/form";
import { EntityStatus } from "@/generated/prisma/enums";

const STATUSES = Object.values(EntityStatus);

function readForm(fd: FormData) {
  return {
    name: reqStr(fd, "name", "ຊື່ບັນຊີ"),
    fbAccountId: str(fd, "fbAccountId"),
    currency: str(fd, "currency") ?? "USD",
    timezone: str(fd, "timezone") ?? "Asia/Vientiane",
    spendCap: num(fd, "spendCap"),
    status: enumVal(fd, "status", STATUSES, EntityStatus.ACTIVE),
    note: str(fd, "note"),
  };
}

export async function createAdAccount(fd: FormData) {
  await requireSession();
  await prisma.adAccount.create({ data: readForm(fd) });
  revalidatePath("/ad-accounts");
  redirect("/ad-accounts");
}

export async function updateAdAccount(id: string, fd: FormData) {
  await requireSession();
  await prisma.adAccount.update({ where: { id }, data: readForm(fd) });
  revalidatePath("/ad-accounts");
  redirect("/ad-accounts");
}

export async function deleteAdAccount(id: string) {
  await requireSession();
  const removed = await prisma.adAccount.delete({ where: { id } });
  await recordAudit("adaccount.delete", removed.name);
  revalidatePath("/ad-accounts");
  redirect("/ad-accounts");
}
