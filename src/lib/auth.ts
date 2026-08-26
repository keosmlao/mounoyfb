/**
 * ລະບົບ login ແບບ "ລະຫັດຜ່ານດຽວຮ່ວມກັນ" — ພຽງພໍສຳລັບທີມນ້ອຍທີ່ເຊື່ອໃຈກັນ
 * ແລະ ບໍ່ຕ້ອງມີຕາຕະລາງຜູ້ໃຊ້ໃນຖານຂໍ້ມູນ.
 *
 * cookie ເກັບພຽງ "ວັນໝົດອາຍຸ + ລາຍເຊັນ HMAC" ຈຶ່ງປອມບໍ່ໄດ້ຖ້າບໍ່ຮູ້ SESSION_SECRET
 * ແລະ ບໍ່ຕ້ອງເກັບ session ໄວ້ຝັ່ງເຊີບເວີ.
 *
 * ໄຟລ໌ນີ້ຖືກ import ຈາກ `proxy.ts` ນຳ ຈຶ່ງ **ຫ້າມ import prisma ຫຼື node:crypto**
 * — ໃຊ້ໄດ້ແຕ່ Web Crypto ທີ່ມີທັງໃນ edge runtime ແລະ Node.
 */

export const SESSION_COOKIE = "fbmonoy_session";

/** ອາຍຸ session — 7 ວັນ ແລ້ວຕ້ອງ login ໃໝ່ */
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

const encoder = new TextEncoder();

/** ລະຫັດຜ່ານທີ່ຕັ້ງໄວ້ໃນ .env — ບໍ່ໄດ້ຕັ້ງ = ລະບົບຖືກລັອກໄວ້ທັງໝົດ */
export function configuredPassword(): string | null {
  return process.env.APP_PASSWORD?.trim() || null;
}

function secret(): string {
  const value = process.env.SESSION_SECRET?.trim();
  if (!value || value.length < 16) {
    throw new Error(
      "ຕ້ອງຕັ້ງ SESSION_SECRET ໃນ .env (ຢ່າງໜ້ອຍ 16 ຕົວອັກສອນ) ກ່ອນຈຶ່ງ login ໄດ້",
    );
  }
  return value;
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return base64url(new Uint8Array(mac));
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** ປຽບທຽບແບບໃຊ້ເວລາຄົງທີ່ — ກັນການເດົາລະຫັດຈາກເວລາຕອບ */
export function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  // ຄວາມຍາວຕ່າງກັນກໍ່ຍັງຕ້ອງວົນຄົບ ເພື່ອບໍ່ໃຫ້ເວລາຕອບບອກຄວາມຍາວ
  const length = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < length; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

/** ສ້າງຄ່າ cookie ໃໝ່ທີ່ໝົດອາຍຸໃນ 7 ວັນ */
export async function createSessionToken(): Promise<{
  value: string;
  maxAge: number;
}> {
  const expires = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  const payload = String(expires);
  return {
    value: `${payload}.${await sign(payload)}`,
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

/** ກວດ cookie — ຄືນ true ສະເພາະລາຍເຊັນຖືກ ແລະ ຍັງບໍ່ໝົດອາຍຸ */
export async function verifySessionToken(
  token: string | undefined,
): Promise<boolean> {
  if (!token) return false;

  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;

  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  const expires = Number(payload);
  if (!Number.isFinite(expires) || expires * 1000 <= Date.now()) return false;

  try {
    return timingSafeEqual(signature, await sign(payload));
  } catch {
    // SESSION_SECRET ບໍ່ໄດ້ຕັ້ງ — ຖືວ່າບໍ່ຜ່ານ
    return false;
  }
}

/** ຄ່າ cookie ມາດຕະຖານ — ອ່ານດ້ວຍ JS ບໍ່ໄດ້ ແລະ ບໍ່ຖືກສົ່ງຂ້າມເວັບ */
export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    // ໃນ production ຄວນແລ່ນຜ່ານ HTTPS — ແຕ່ໃນເຄືອຂ່າຍພາຍໃນມັກເປັນ http
    // ຈຶ່ງເປີດຜ່ານ .env ແທນທີ່ຈະບັງຄັບ (ບັງຄັບແລ້ວ cookie ຈະບໍ່ຖືກສົ່ງເລີຍ)
    secure: process.env.COOKIE_SECURE === "1",
  };
}
