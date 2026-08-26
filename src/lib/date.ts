/**
 * ຄໍລຳ @db.Date ຖືກເກັບເປັນ UTC midnight ສະເໝີ.
 * ທຸກການແປງວັນທີ່ໃນລະບົບນີ້ຕ້ອງຜ່ານ helper ຢູ່ໄຟລ໌ນີ້ ເພື່ອບໍ່ໃຫ້ timezone ເລື່ອນວັນ.
 */

/** "2026-07-26" → Date (UTC midnight) */
export function parseDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`ວັນທີ່ບໍ່ຖືກຕ້ອງ: ${value}`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`ວັນທີ່ບໍ່ຖືກຕ້ອງ: ${value}`);
  }
  return date;
}

/** Date → "2026-07-26" */
export function toDateInput(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toISOString().slice(0, 10);
}

/** ວັນທີ່ມື້ນີ້ຕາມເວລາລາວ (UTC+7) ໃນຮູບແບບ "YYYY-MM-DD" */
export function todayStr(): string {
  const now = new Date();
  const laos = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return laos.toISOString().slice(0, 10);
}

/** ບວກ/ລົບວັນຈາກ "YYYY-MM-DD" */
export function addDays(value: string, days: number): string {
  const d = parseDate(value);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateInput(d);
}

export function startOfMonth(value: string): string {
  return `${value.slice(0, 7)}-01`;
}

export function endOfMonth(value: string): string {
  const d = parseDate(startOfMonth(value));
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return toDateInput(d);
}

export type DateRange = { from: string; to: string };

/** ອ່ານຊ່ວງວັນຈາກ query string, ຄ່າ default = 30 ວັນຫຼ້າສຸດ */
export function resolveRange(params: {
  from?: string;
  to?: string;
  preset?: string;
}): DateRange {
  const today = todayStr();

  switch (params.preset) {
    case "today":
      return { from: today, to: today };
    case "yesterday":
      return { from: addDays(today, -1), to: addDays(today, -1) };
    case "7d":
      return { from: addDays(today, -6), to: today };
    case "30d":
      return { from: addDays(today, -29), to: today };
    case "month":
      return { from: startOfMonth(today), to: today };
    case "lastMonth": {
      const lastMonthDay = addDays(startOfMonth(today), -1);
      return { from: startOfMonth(lastMonthDay), to: endOfMonth(lastMonthDay) };
    }
  }

  const from = params.from ?? addDays(today, -29);
  const to = params.to ?? today;
  return from <= to ? { from, to } : { from: to, to: from };
}

/** ລາຍການວັນທັງໝົດໃນຊ່ວງ (ໃຊ້ແຕ້ມກຣາຟ ບໍ່ໃຫ້ຂາດວັນ) */
export function eachDay({ from, to }: DateRange): string[] {
  const out: string[] = [];
  let cur = from;
  // ກັນ loop ຍາວເກີນ ຖ້າຊ່ວງກວ້າງຜິດປົກກະຕິ
  for (let i = 0; cur <= to && i < 400; i++) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

/** ຊ່ວງກ່ອນໜ້າທີ່ຍາວເທົ່າກັນ — ໃຊ້ປຽບທຽບ % ການປ່ຽນແປງ */
export function previousRange({ from, to }: DateRange): DateRange {
  const days = countDays({ from, to });
  return { from: addDays(from, -days), to: addDays(to, -days) };
}

const LAO_MONTHS = [
  "ມ.ກ.",
  "ກ.ພ.",
  "ມີ.ນ.",
  "ມ.ສ.",
  "ພ.ພ.",
  "ມິ.ຖ.",
  "ກ.ລ.",
  "ສ.ຫ.",
  "ກ.ຍ.",
  "ຕ.ລ.",
  "ພ.ຈ.",
  "ທ.ວ.",
];

/** "2026-07-26" → "26 ກ.ລ. 2026" */
export function formatDateLao(value: Date | string): string {
  const s = typeof value === "string" ? value : toDateInput(value);
  const [y, m, d] = s.split("-");
  return `${Number(d)} ${LAO_MONTHS[Number(m) - 1]} ${y}`;
}

/** "2026-07-26" → "26/07" (ໃຊ້ໃນແກນກຣາຟ) */
export function formatDayShort(value: string): string {
  const [, m, d] = value.split("-");
  return `${d}/${m}`;
}

/**
 * ຕັດຊ່ວງວັນອອກເປັນທ່ອນລະ `size` ວັນ (ຕັ້ງຕົ້ນ 7 = 1 ອາທິດ).
 * ໃຊ້ໃນການ sync ເພື່ອບໍ່ໃຫ້ຮ້ອງ API ເທື່ອດຽວຍາວເກີນຈົນ timeout.
 */
export function chunkRange({ from, to }: DateRange, size = 7): DateRange[] {
  const out: DateRange[] = [];
  let start = from;
  // ກັນ loop ຍາວເກີນ ຖ້າຊ່ວງກວ້າງຜິດປົກກະຕິ (ຄືກັບ eachDay)
  for (let i = 0; start <= to && i < 400; i++) {
    const end = addDays(start, size - 1);
    out.push({ from: start, to: end < to ? end : to });
    start = addDays(start, size);
  }
  return out;
}

/** ຈຳນວນວັນໃນຊ່ວງ (ນັບທັງວັນຕົ້ນ ແລະ ວັນທ້າຍ) */
export function countDays(range: DateRange): number {
  const from = parseDate(range.from).getTime();
  const to = parseDate(range.to).getTime();
  if (from > to) throw new Error("ວັນທີ່ເລີ່ມຕ້ອງບໍ່ກາຍວັນທີ່ສິ້ນສຸດ");
  return Math.floor((to - from) / (24 * 60 * 60 * 1000)) + 1;
}
