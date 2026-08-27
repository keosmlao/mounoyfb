"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { currentUser, requireAdmin } from "@/lib/auth-server";
import { hashPassword } from "@/lib/password";
import { recordAudit } from "@/lib/audit";
import { reqStr, str } from "@/lib/form";
import { UserRole } from "@/generated/prisma/enums";

/**
 * ຈັດການຜູ້ໃຊ້.
 *
 * ຈົນກວ່າຈະສ້າງຜູ້ໃຊ້ຄົນທຳອິດ ລະບົບຍັງໃຊ້ລະຫັດຜ່ານດຽວຮ່ວມກັນຄືເກົ່າ —
 * ຄົນທຳອິດທີ່ສ້າງຈຶ່ງຖືກຕັ້ງເປັນ ADMIN ອັດຕະໂນມັດ ບໍ່ດັ່ງນັ້ນຈະບໍ່ມີໃຜ
 * ຈັດການຜູ້ໃຊ້ຕໍ່ໄດ້ ແລະ ຕ້ອງໄປແກ້ໃນຖານຂໍ້ມູນເອງ.
 */

const MIN_PASSWORD = 8;

/** ຊື່ເຂົ້າລະບົບ — ຕົວພິມນ້ອຍ, ບໍ່ມີຊ່ອງຫວ່າງ ເພື່ອບໍ່ໃຫ້ພິມຜິດຕອນ login */
function normalizeName(raw: string): string {
  const name = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (name.length < 2) throw new Error("ຊື່ຜູ້ໃຊ້ສັ້ນເກີນ (ຢ່າງໜ້ອຍ 2 ຕົວ)");
  if (!/^[a-z0-9._-]+$/.test(name)) {
    throw new Error("ຊື່ຜູ້ໃຊ້ໃຊ້ໄດ້ແຕ່ a-z, 0-9, ຈຸດ, ຂີດ (ບໍ່ໃຊ້ພາສາລາວ)");
  }
  return name;
}

function checkPassword(raw: string): string {
  if (raw.length < MIN_PASSWORD) {
    throw new Error(`ລະຫັດຜ່ານສັ້ນເກີນ — ຢ່າງໜ້ອຍ ${MIN_PASSWORD} ຕົວ`);
  }
  return raw;
}

export async function createUser(fd: FormData) {
  await requireAdmin();

  const name = normalizeName(reqStr(fd, "name", "ຊື່ຜູ້ໃຊ້"));
  const password = checkPassword(reqStr(fd, "password", "ລະຫັດຜ່ານ"));
  const displayName = str(fd, "displayName") ?? name;

  if (await prisma.user.findUnique({ where: { name }, select: { id: true } })) {
    throw new Error(`ມີຜູ້ໃຊ້ຊື່ “${name}” ຢູ່ແລ້ວ`);
  }

  // ຄົນທຳອິດຕ້ອງເປັນ ADMIN ສະເໝີ ບໍ່ວ່າຟອມຈະສົ່ງຫຍັງມາ
  const isFirst = (await prisma.user.count()) === 0;
  const role = isFirst
    ? UserRole.ADMIN
    : str(fd, "role") === "ADMIN"
      ? UserRole.ADMIN
      : UserRole.MEMBER;

  await prisma.user.create({
    data: { name, displayName, passwordHash: hashPassword(password), role },
  });

  await recordAudit("settings.user", name, `ສ້າງຜູ້ໃຊ້ໃໝ່ (${role})`);
  revalidatePath("/settings");
}

export async function setUserPassword(id: string, fd: FormData) {
  await requireAdmin();

  const password = checkPassword(reqStr(fd, "password", "ລະຫັດຜ່ານ"));
  const user = await prisma.user.update({
    where: { id },
    data: { passwordHash: hashPassword(password) },
    select: { name: true },
  });

  await recordAudit("settings.user", user.name, "ປ່ຽນລະຫັດຜ່ານ");
  revalidatePath("/settings");
}

export async function setUserRole(id: string, role: UserRole) {
  const admin = await requireAdmin();

  // ຢ່າໃຫ້ຄົນຖອດສິດຕົນເອງຈົນບໍ່ມີ ADMIN ເຫຼືອ ແລ້ວລັອກຕົນເອງອອກ
  if (role !== UserRole.ADMIN) {
    const admins = await prisma.user.count({
      where: { role: UserRole.ADMIN, active: true },
    });
    if (admins <= 1) {
      throw new Error("ຕ້ອງເຫຼືອຜູ້ດູແລລະບົບຢ່າງໜ້ອຍ 1 ຄົນ");
    }
    if (admin?.id === id) {
      throw new Error("ຖອດສິດຜູ້ດູແລຂອງຕົນເອງບໍ່ໄດ້ — ໃຫ້ຄົນອື່ນເຮັດໃຫ້");
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data: { role },
    select: { name: true },
  });

  await recordAudit("settings.user", user.name, `ປ່ຽນສິດເປັນ ${role}`);
  revalidatePath("/settings");
}

/**
 * ປິດ / ເປີດ ຜູ້ໃຊ້.
 * ບໍ່ໄດ້ລຶບແຖວ — ບັນທຶກການກະທຳຈະໄດ້ຍັງອ້າງເຖິງຄົນນັ້ນໄດ້ຢູ່.
 */
export async function setUserActive(id: string, active: boolean) {
  const admin = await requireAdmin();

  if (!active) {
    if (admin?.id === id) throw new Error("ປິດບັນຊີຂອງຕົນເອງບໍ່ໄດ້");

    const others = await prisma.user.count({
      where: { active: true, id: { not: id } },
    });
    if (others === 0) {
      throw new Error("ປິດຄົນສຸດທ້າຍບໍ່ໄດ້ — ຈະບໍ່ມີໃຜເຂົ້າລະບົບໄດ້ອີກ");
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data: { active },
    select: { name: true },
  });

  await recordAudit("settings.user", user.name, active ? "ເປີດບັນຊີ" : "ປິດບັນຊີ");
  revalidatePath("/settings");
}

/** ຜູ້ໃຊ້ປ່ຽນລະຫັດຂອງຕົນເອງ — ບໍ່ຕ້ອງເປັນ ADMIN ແຕ່ຕ້ອງຮູ້ລະຫັດເກົ່າ */
export async function changeOwnPassword(fd: FormData) {
  const me = await currentUser();
  if (!me) throw new Error("ຕ້ອງເຂົ້າສູ່ລະບົບດ້ວຍບັນຊີຜູ້ໃຊ້ກ່ອນ");

  const { verifyPassword } = await import("@/lib/password");
  const stored = await prisma.user.findUnique({
    where: { id: me.id },
    select: { passwordHash: true },
  });
  if (!stored || !verifyPassword(reqStr(fd, "current", "ລະຫັດຜ່ານປັດຈຸບັນ"), stored.passwordHash)) {
    throw new Error("ລະຫັດຜ່ານປັດຈຸບັນບໍ່ຖືກຕ້ອງ");
  }

  const password = checkPassword(reqStr(fd, "password", "ລະຫັດຜ່ານໃໝ່"));
  await prisma.user.update({
    where: { id: me.id },
    data: { passwordHash: hashPassword(password) },
  });

  await recordAudit("settings.user", me.name, "ປ່ຽນລະຫັດຜ່ານຂອງຕົນເອງ");
  revalidatePath("/settings");
}
