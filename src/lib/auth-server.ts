import "server-only";

import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "./auth";
import { prisma } from "./prisma";
import type { UserRole } from "@/generated/prisma/enums";

/**
 * ກວດ session ຢູ່ entry point ຝັ່ງ server ເອງ.
 * Proxy ຊ່ວຍກັນໜ້າຈໍ, ແຕ່ Server Actions/Route Handlers ຍັງຕ້ອງກວດຊ້ຳ.
 */

export type CurrentUser = {
  id: string;
  name: string;
  displayName: string;
  role: UserRole;
};

/**
 * ຜ່ານດ່ານບໍ່ — ກວດເລິກກວ່າ `proxy.ts`.
 *
 * Proxy ກວດໄດ້ແຕ່ລາຍເຊັນ (ມັນໃຊ້ prisma ບໍ່ໄດ້) ຈຶ່ງຕ້ອງກວດຕໍ່ຢູ່ນີ້ວ່າ:
 * - ຜູ້ໃຊ້ທີ່ session ຊີ້ໄປຫາ **ຍັງເປີດຢູ່** — ບໍ່ດັ່ງນັ້ນຄົນທີ່ຖືກປິດບັນຊີ
 *   ຈະຍັງໃຊ້ລະບົບໄດ້ຕໍ່ອີກ 7 ວັນຈົນກວ່າ cookie ຈະໝົດອາຍຸ
 * - session ແບບ "ລະຫັດຜ່ານຮ່ວມ" ໃຊ້ບໍ່ໄດ້ອີກເມື່ອສ້າງບັນຊີຜູ້ໃຊ້ແລ້ວ
 */
export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) return false;

  if (!session.userId) return !(await hasUsers());

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { active: true },
  });
  return Boolean(user?.active);
}

export async function requireSession(): Promise<void> {
  if (!(await isAuthenticated())) {
    throw new Error("Unauthorized");
  }
}

/**
 * ຄົນທີ່ກຳລັງໃຊ້ຢູ່ — `null` ເມື່ອເປັນ session ແບບລະຫັດຜ່ານດຽວຮ່ວມກັນ
 * (ຮ້ານທີ່ຍັງບໍ່ໄດ້ສ້າງຜູ້ໃຊ້) ຫຼື ເມື່ອຜູ້ໃຊ້ຄົນນັ້ນຖືກປິດໄປແລ້ວ.
 */
export async function currentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session?.userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, displayName: true, role: true, active: true },
  });
  if (!user?.active) return null;

  return {
    id: user.id,
    name: user.name,
    displayName: user.displayName,
    role: user.role,
  };
}

/** ມີຜູ້ໃຊ້ໃນລະບົບແລ້ວບໍ່ — ມີແລ້ວຈຶ່ງບັງຄັບ login ດ້ວຍຊື່ + ລະຫັດ */
export async function hasUsers(): Promise<boolean> {
  return (await prisma.user.count({ where: { active: true } })) > 0;
}

/**
 * ບັງຄັບສິດ ADMIN.
 *
 * ຮ້ານທີ່ຍັງໃຊ້ລະຫັດຜ່ານດຽວຮ່ວມກັນ (ຍັງບໍ່ມີຜູ້ໃຊ້ຈັກຄົນ) ຖືວ່າຜ່ານ —
 * ບໍ່ດັ່ງນັ້ນຄົນຈະສ້າງຜູ້ໃຊ້ຄົນທຳອິດບໍ່ໄດ້ເລີຍ.
 */
export async function requireAdmin(): Promise<CurrentUser | null> {
  await requireSession();

  const user = await currentUser();
  if (!user) {
    if (await hasUsers()) {
      throw new Error("ຕ້ອງເຂົ້າສູ່ລະບົບດ້ວຍບັນຊີຜູ້ໃຊ້ກ່ອນ");
    }
    return null; // ຍັງບໍ່ມີຜູ້ໃຊ້ — ໃຫ້ຕັ້ງຄົນທຳອິດໄດ້
  }

  if (user.role !== "ADMIN") {
    throw new Error("ສະເພາະຜູ້ດູແລລະບົບ (ADMIN) ຈຶ່ງເຮັດສິ່ງນີ້ໄດ້");
  }
  return user;
}
