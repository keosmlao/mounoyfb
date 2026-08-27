import { prisma } from "./prisma";

/**
 * ຄຳຕອບສຳເລັດຮູບ — ຮ້ານຕອບ “ລາຄາເທົ່າໃດ / ວິທີສັ່ງ / ຄ່າສົ່ງ” ຊ້ຳໆທຸກມື້
 * ຈຶ່ງເກັບໄວ້ໃຫ້ກົດເລືອກ ແທນທີ່ຈະພິມໃໝ່ທຸກເທື່ອ.
 *
 * ເກັບເປັນຂໍ້ຄວາມແຖວລະ 1 ຄຳຕອບໃນ `AppSetting` — ບໍ່ຄຸ້ມທີ່ຈະເຮັດຕາຕະລາງ
 * ຕ່າງຫາກສຳລັບລາຍການສັ້ນໆທີ່ບໍ່ມີສະຖານະຫຍັງ.
 */
const KEY = "cannedReplies";

/** ຈຳກັດໄວ້ ບໍ່ໃຫ້ແຖວປຸ່ມຍາວຈົນໃຊ້ຍາກ */
const MAX = 12;

export const DEFAULT_CANNED = [
  "ສົນໃຈແມ່ນທັກແຊັດມາເລີຍເດີ້ 🙏",
  "ລາຄາ 29,000 ກີບ ຈ້າ",
  "ມີສົ່ງທົ່ວປະເທດ ເກັບເງິນປາຍທາງໄດ້ຈ້າ",
  "ແອດມິນທັກໄປໃນແຊັດແລ້ວເດີ້ ✅",
];

export async function getCannedReplies(): Promise<string[]> {
  const row = await prisma.appSetting.findUnique({ where: { key: KEY } });
  if (!row) return DEFAULT_CANNED;
  return parseCanned(row.value);
}

/** ແຍກເປັນແຖວ, ຕັດອັນວ່າງ ແລະ ອັນຊ້ຳອອກ */
export function parseCanned(value: string): string[] {
  const seen = new Set<string>();
  for (const line of value.split("\n")) {
    const text = line.trim();
    if (text) seen.add(text);
  }
  return [...seen].slice(0, MAX);
}

export async function saveCannedReplies(value: string): Promise<void> {
  const text = parseCanned(value).join("\n");
  await prisma.appSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: text },
    update: { value: text },
  });
}
