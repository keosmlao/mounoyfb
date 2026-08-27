"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  configuredPassword,
  createSessionToken,
  sessionCookieOptions,
  timingSafeEqual,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

/**
 * ຈຳກັດຈຳນວນຄັ້ງທີ່ເດົາລະຫັດ — ເກັບໄວ້ໃນໜ່ວຍຄວາມຈຳຂອງ process ພຽງພໍ
 * ສຳລັບເຊີບເວີດຽວທີ່ແລ່ນໃນເຄືອຂ່າຍພາຍໃນ (restart ແລ້ວຄ່າຫາຍໄປ ຖືວ່າຮັບໄດ້)
 */
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;

type Attempt = { count: number; firstAt: number };
const attempts = new Map<string, Attempt>();

function checkRate(ip: string): { blocked: boolean; left: number } {
  const now = Date.now();
  const current = attempts.get(ip);

  if (!current || now - current.firstAt > WINDOW_MS) {
    return { blocked: false, left: MAX_ATTEMPTS };
  }
  return {
    blocked: current.count >= MAX_ATTEMPTS,
    left: Math.max(0, MAX_ATTEMPTS - current.count),
  };
}

function recordFailure(ip: string) {
  const now = Date.now();
  const current = attempts.get(ip);
  if (!current || now - current.firstAt > WINDOW_MS) {
    attempts.set(ip, { count: 1, firstAt: now });
    return;
  }
  current.count++;
}

async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "local"
  );
}

/** ຂໍ້ຄວາມຜິດພາດທີ່ສົ່ງກັບໄປສະແດງໃນຟອມ (null = ສຳເລັດ ແລ້ວ redirect ໄປແລ້ວ) */
/**
 * ກວດຜູ້ໃຊ້ຈາກຕາຕະລາງ `User` — ຄືນ id ເມື່ອຜ່ານ.
 *
 * ຊື່ບໍ່ພົບ ກັບ ລະຫັດຜິດ ຄືນຄ່າອັນດຽວກັນ (null) ໂດຍເຈດຕະນາ —
 * ບໍ່ດັ່ງນັ້ນຄົນນອກຈະໄລ່ຫາໄດ້ວ່າມີຊື່ຜູ້ໃຊ້ໃດຢູ່ໃນລະບົບແດ່.
 */
async function checkUser(name: string, password: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { name: name.trim().toLowerCase() },
    select: { id: true, passwordHash: true, active: true },
  });
  if (!user?.active) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  return user.id;
}

export async function login(
  _prev: string | null,
  fd: FormData,
): Promise<string | null> {
  const ip = await clientIp();
  if (checkRate(ip).blocked) {
    return "ພິມລະຫັດຜິດຫຼາຍເທື່ອເກີນໄປ — ລໍຖ້າ 10 ນາທີແລ້ວລອງໃໝ່";
  }

  const password = String(fd.get("password") ?? "");
  const name = String(fd.get("name") ?? "").trim();

  // ມີບັນຊີຜູ້ໃຊ້ແລ້ວ = ບັງຄັບ login ດ້ວຍຊື່ + ລະຫັດ
  // ຍັງບໍ່ມີຈັກຄົນ = ໃຊ້ລະຫັດຜ່ານດຽວຮ່ວມກັນຈາກ .env ຄືເກົ່າ
  const usersExist = (await prisma.user.count({ where: { active: true } })) > 0;

  let userId: string | null = null;

  if (usersExist) {
    if (!name) return "ໃສ່ຊື່ຜູ້ໃຊ້ດ້ວຍ";
    userId = await checkUser(name, password);
    if (!userId) {
      recordFailure(ip);
      const { left } = checkRate(ip);
      return left > 0
        ? `ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ (ເຫຼືອ ${left} ຄັ້ງ)`
        : "ພິມລະຫັດຜິດຫຼາຍເທື່ອເກີນໄປ — ລໍຖ້າ 10 ນາທີແລ້ວລອງໃໝ່";
    }
  } else {
    const expected = configuredPassword();
    if (!expected) {
      return "ຍັງບໍ່ໄດ້ຕັ້ງ APP_PASSWORD ໃນ .env — ຕັ້ງກ່ອນຈຶ່ງເຂົ້າລະບົບໄດ້";
    }
    if (!timingSafeEqual(password, expected)) {
      recordFailure(ip);
      const { left } = checkRate(ip);
      return left > 0
        ? `ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ (ເຫຼືອ ${left} ຄັ້ງ)`
        : "ພິມລະຫັດຜິດຫຼາຍເທື່ອເກີນໄປ — ລໍຖ້າ 10 ນາທີແລ້ວລອງໃໝ່";
    }
  }

  attempts.delete(ip);

  let token: Awaited<ReturnType<typeof createSessionToken>>;
  try {
    token = await createSessionToken(userId);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, token.value, sessionCookieOptions(token.maxAge));

  // ພາໄປໜ້າທີ່ຜູ້ໃຊ້ຢາກໄປແຕ່ຕົ້ນ — ຮັບສະເພາະເສັ້ນທາງພາຍໃນ ກັນ open redirect
  const next = String(fd.get("next") ?? "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
