import "server-only";

import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "./auth";

/**
 * ກວດ session ຢູ່ entry point ຝັ່ງ server ເອງ.
 * Proxy ຊ່ວຍກັນໜ້າຈໍ, ແຕ່ Server Actions/Route Handlers ຍັງຕ້ອງກວດຊ້ຳ.
 */
export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

export async function requireSession(): Promise<void> {
  if (!(await isAuthenticated())) {
    throw new Error("Unauthorized");
  }
}
