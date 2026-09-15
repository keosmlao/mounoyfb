/**
 * ອ່ານຄຳບັນຍາຍໂພສຂອງເພຈ ເປັນຂໍ້ມູນສິນຄ້າເບື້ອງຕົ້ນ — ບໍລິສຸດ · ມີ test ຄຸມ.
 *
 * ເປັນແຕ່ "ຮ່າງ" ໃຫ້ຄົນກວດກ່ອນບັນທຶກສະເໝີ — ຄຳບັນຍາຍຂອງແຕ່ລະຮ້ານຂຽນບໍ່ຄືກັນ
 * ອ່ານຜິດແລ້ວບັນທຶກເອງ = ລາຄາຜິດໃນບິນ.
 */

export type CaptionDraft = {
  name: string;
  /** ລາຄາເປັນກີບ — null = ຫາບໍ່ພົບ ຫຼື ບໍ່ແນ່ໃຈ */
  price: number | null;
};

/** ຊື່ຍາວກວ່ານີ້ ມັກແມ່ນປະໂຫຍກໂຄສະນາ ບໍ່ແມ່ນຊື່ສິນຄ້າ */
const NAME_MAX = 80;

function toAsciiDigits(value: string): string {
  return value
    .replace(/[໐-໙]/g, (d) => String(d.charCodeAt(0) - 0x0ed0))
    .replace(/[๐-๙]/g, (d) => String(d.charCodeAt(0) - 0x0e50));
}

/** ແຖວທີ່ບໍ່ແມ່ນຊື່: hashtag ລ້ວນ, ລາຄາ, ເບີໂທ, ລິ້ງ */
function isNoiseLine(line: string): boolean {
  if (/^(#\S+\s*)+$/.test(line)) return true;
  if (/^(ລາຄາ|ราคา|price)\b/i.test(line)) return true;
  if (/https?:\/\/|www\./i.test(line)) return true;
  if (/^[\d\s+().-]{8,}$/.test(line)) return true;
  return false;
}

/** ຕັດ emoji/ສັນຍາລັກ ທີ່ຫົວ-ທ້າຍແຖວ ("🔥🔥 ເສື້ອ ✨") */
function trimDecor(line: string): string {
  return line
    .replace(/^[\p{Extended_Pictographic}\p{S}\p{P}\s‍️]+/u, "")
    .replace(/[\p{Extended_Pictographic}\p{S}\s‍️]+$/u, "")
    .trim();
}

const UNIT: Record<string, number> = {
  k: 1_000,
  ພັນ: 1_000,
  ພ: 1_000,
  ລ້ານ: 1_000_000,
  m: 1_000_000,
};

/**
 * ຫາລາຄາ — ຮັບ "ລາຄາ 150,000 ກີບ", "ລາຄາ: 150k", "150 ພັນ", "1.5 ລ້ານ", "99.000₭".
 * ຕົວເລກລ້ວນທີ່ບໍ່ມີຄຳວ່າລາຄາ ຫຼື ໜ່ວຍເງິນ ບໍ່ນັບ (ອາດເປັນຂະໜາດ, ເບີໂທ, ລະຫັດ).
 */
export function findPrice(text: string): number | null {
  const ascii = toAsciiDigits(text);
  const number = String.raw`(\d{1,3}(?:[.,\s]\d{3})+|\d+(?:[.,]\d+)?)`;
  const unit = String.raw`(k|K|ພັນ|ພ|ລ້ານ|m|M)?`;
  const currency = String.raw`(ກີບ|ກິບ|₭|kip|LAK)`;

  const patterns = [
    // ມີຄຳວ່າລາຄາ — ໜ່ວຍເງິນມີ ຫຼື ບໍ່ມີກໍ່ໄດ້
    new RegExp(String.raw`(?:ລາຄາ|ราคา|price)\s*[:：=\-]?\s*${number}\s*${unit}`, "i"),
    // ບໍ່ມີຄຳວ່າລາຄາ — ຕ້ອງມີໜ່ວຍເງິນ ຫຼື ພັນ/ລ້ານ ຕາມຫຼັງ
    new RegExp(String.raw`${number}\s*${unit}\s*${currency}`, "i"),
    new RegExp(String.raw`${number}\s*(ພັນ|ລ້ານ)`, "i"),
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(ascii);
    if (!match) continue;
    const value = parseAmount(match[1], match[2]);
    if (value !== null) return value;
  }
  return null;
}

function parseAmount(raw: string, unitRaw: string | undefined): number | null {
  const unit = unitRaw ? UNIT[unitRaw.toLowerCase()] ?? UNIT[unitRaw] ?? 1 : 1;
  let value: number;
  if (/^\d{1,3}(?:[.,\s]\d{3})+$/.test(raw)) {
    // ຈຸດ/ຈຸດ/ຍະຫວ່າງ ຄັ່ນຫຼັກພັນ — ລາວໃຊ້ທັງ 150.000 ແລະ 150,000
    value = Number(raw.replace(/[.,\s]/g, ""));
  } else {
    value = Number(raw.replace(",", "."));
  }
  if (!Number.isFinite(value)) return null;
  const total = Math.round(value * unit);
  // ຕ່ຳກວ່າ 1,000 ກີບ ຫຼື ເກີນ 1 ຕື້ = ອ່ານຜິດແນ່ນອນ
  return total >= 1_000 && total <= 1_000_000_000 ? total : null;
}

export function draftFromCaption(caption: string | null | undefined): CaptionDraft {
  // ກວດແຖວຂີ້ເຫຍື້ອກ່ອນຕັດເຄື່ອງປະດັບ — ບໍ່ດັ່ງນັ້ນ "#ໂປຣ" ຈະເສຍ # ແລ້ວກາຍເປັນຊື່
  const nameLine =
    (caption ?? "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !isNoiseLine(trimDecor(l)) && !/^#/.test(l))
      .map((l) => trimDecor(l))
      .find(Boolean) ?? "";
  // ຕັດ hashtag ແລະ ລາຄາທີ່ຕິດມາໃນແຖວຊື່ອອກ
  const name = nameLine
    .replace(/#\S+/g, "")
    .replace(/(ລາຄາ|ราคา|price)\s*[:：=\-]?.*$/i, "")
    .trim()
    .slice(0, NAME_MAX)
    .trim();

  return { name, price: findPrice(caption ?? "") };
}
