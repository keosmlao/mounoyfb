import { parseDate } from "./date";

/** ຂໍ້ຄວາມ — ຕັດຊ່ອງວ່າງ, ຖ້າວ່າງຄືນ null */
export function str(fd: FormData, key: string): string | null {
  const raw = fd.get(key);
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

/** ຂໍ້ຄວາມທີ່ຕ້ອງມີ — ຂາດແລ້ວ throw */
export function reqStr(fd: FormData, key: string, label = key): string {
  const value = str(fd, key);
  if (!value) throw new Error(`ຕ້ອງໃສ່ "${label}"`);
  return value;
}

/** ຕົວເລກ — ວ່າງຄືນ null */
export function num(fd: FormData, key: string): number | null {
  const value = str(fd, key);
  if (value === null) return null;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

/** ຕົວເລກທີ່ຕ້ອງມີຄ່າ — ວ່າງຄືນ 0 */
export function num0(fd: FormData, key: string): number {
  return num(fd, key) ?? 0;
}

/** ຈຳນວນເຕັມ ≥ 0 */
export function int0(fd: FormData, key: string): number {
  return Math.max(0, Math.round(num(fd, key) ?? 0));
}

/** ວັນທີ່ຈາກ <input type="date"> */
export function date(fd: FormData, key: string): Date | null {
  const value = str(fd, key);
  return value ? parseDate(value) : null;
}

export function reqDate(fd: FormData, key: string, label = key): Date {
  const value = date(fd, key);
  if (!value) throw new Error(`ຕ້ອງໃສ່ "${label}"`);
  return value;
}

export function bool(fd: FormData, key: string): boolean {
  const raw = fd.get(key);
  return raw === "on" || raw === "true" || raw === "1";
}

/** ຄ່າ enum — ຖ້າບໍ່ຢູ່ໃນລາຍການທີ່ອະນຸຍາດ ຄືນຄ່າ default */
export function enumVal<T extends string>(
  fd: FormData,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = str(fd, key);
  return value && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}
