import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * ເກັບລະຫັດຜ່ານ.
 *
 * ໃຊ້ PBKDF2 ທີ່ມາກັບ Node ຢູ່ແລ້ວ — ບໍ່ຕ້ອງເພີ່ມ dependency ພາຍນອກ
 * ຊຶ່ງເປັນເລື່ອງດີສຳລັບສ່ວນທີ່ກ່ຽວກັບຄວາມປອດໄພ (ຫຼຸດສິ່ງທີ່ຕ້ອງເຊື່ອໃຈລົງ).
 *
 * **ໄຟລ໌ນີ້ຫ້າມຖືກ import ຈາກ `proxy.ts` ຫຼື client component** —
 * `node:crypto` ໃຊ້ບໍ່ໄດ້ຢູ່ນັ້ນ. ການກວດ cookie ຢູ່ `auth.ts` ໃຊ້ Web Crypto ຕ່າງຫາກ.
 *
 * ບໍ່ໃສ່ `server-only` ໄວ້ ເພື່ອໃຫ້ `password.test.ts` import ໄດ້ —
 * ຟັງຊັນໃນນີ້ບໍລິສຸດ (ບໍ່ແຕະ request ຫຼື ຖານຂໍ້ມູນ) ຈຶ່ງທົດສອບໄດ້ຢ່າງປອດໄພ.
 */

/** ຮອບການຄິດ — ຊ້າພໍທີ່ຈະໄລ່ເດົາບໍ່ຄຸ້ມ ແຕ່ຍັງບໍ່ຊ້າຈົນຄົນລໍບໍ່ໄດ້ */
const ITERATIONS = 210_000;
const KEY_LENGTH = 32;
const DIGEST = "sha512";

/** "pbkdf2$<ຮອບ>$<salt hex>$<hash hex>" — ເກັບຮອບໄວ້ນຳ ເພື່ອເພີ່ມໄດ້ພາຍຫຼັງ */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST);
  return `pbkdf2$${ITERATIONS}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

/**
 * ກວດລະຫັດຜ່ານ. ຄືນ `false` ສະເໝີເມື່ອຮູບແບບຜິດ —
 * ບໍ່ throw ເພື່ອບໍ່ໃຫ້ແຖວທີ່ເສຍໃນຖານຂໍ້ມູນເຮັດໃຫ້ໜ້າ login ພັງທັງໜ້າ.
 */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;

  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations <= 0) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[2], "hex");
    expected = Buffer.from(parts[3], "hex");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  const actual = pbkdf2Sync(password, salt, iterations, expected.length, DIGEST);
  return timingSafeEqual(actual, expected);
}
