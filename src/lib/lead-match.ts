/**
 * ຫາລູກຄ້າທີ່ "ແມ່ນຄົນດຽວກັນ" ກັບຄົນທີ່ຫາກໍ່ທັກມາ.
 *
 * ເປັນຫຍັງຕ້ອງມີ: ຄົນດຽວກັນ comment ໃສ່ 3 ໂພສ ຫຼື ທັກມາອາທິດລະເທື່ອ
 * ຈະກາຍເປັນລູກຄ້າ 3-4 ຄົນໃນລະບົບ. ຜົນຄື **ອັດຕາປິດການຂາຍຕ່ຳກວ່າຄວາມຈິງ**
 * (ຕົວຫານໃຫຍ່ເກີນ) ແລະ ຄົນຕາມງານໂທຫາຄົນເກົ່າຊ້ຳໆ ຈົນລູກຄ້າລຳຄານ.
 *
 * ໄຟລ໌ນີ້ບໍ່ແຕະຖານຂໍ້ມູນ — ຮັບລາຍຊື່ທີ່ອ່ານມາແລ້ວເຂົ້າມາຢ່າງດຽວ ຈຶ່ງທົດສອບໄດ້.
 */

/** ຜູ້ສະໝັກທີ່ຈະເອົາມາທຽບ — ເອົາສະເພາະຊ່ອງທີ່ໃຊ້ຕັດສິນ */
export type LeadCandidate = {
  id: string;
  name: string;
  fbName: string | null;
  phone: string | null;
};

/** ຄົນທີ່ຫາກໍ່ທັກມາ (ຈາກ comment ຫຼື ຫ້ອງແຊັດ) */
export type IncomingPerson = {
  fbName: string | null;
  phone?: string | null;
};

/**
 * ເບີໂທໃຫ້ເຫຼືອແຕ່ຕົວເລກ — "020 5555 001", "02055-55001" ແລະ "+8562055 55001"
 * ຄືເບີອັນດຽວກັນ. ຕັດລະຫັດປະເທດລາວ (856) ອອກ ແລ້ວຕື່ມ 0 ນຳໜ້າຄືນ
 * ເພື່ອໃຫ້ເບີທີ່ບັນທຶກສອງແບບຍັງທຽບກັນຕິດ.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("856")) digits = `0${digits.slice(3)}`;
  // ສັ້ນກວ່າ 8 ຕົວແມ່ນເບີບໍ່ຄົບ — ເອົາໄປທຽບຈະຈັບຜິດຄົນ
  return digits.length >= 8 ? digits : null;
}

/**
 * ຊື່ສຳລັບປຽບທຽບ — ຕັດຊ່ອງຫວ່າງຊ້ຳ ແລະ ບໍ່ແຍກຕົວພິມໃຫຍ່ນ້ອຍ.
 * ຄືນ `null` ສຳລັບຊື່ທີ່ບອກຫຍັງບໍ່ໄດ້ ເພື່ອບໍ່ໃຫ້ຄົນ "ບໍ່ຮູ້ຊື່" ຫຼາຍຄົນ
 * ຖືກລວມເປັນຄົນດຽວກັນໝົດ.
 */
const MEANINGLESS = new Set(["", "ບໍ່ຮູ້ຊື່", "-", "—"]);

export function normalizeName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const clean = raw.trim().replace(/\s+/g, " ").toLowerCase();
  return MEANINGLESS.has(clean) ? null : clean;
}

/**
 * ຫາລູກຄ້າເກົ່າທີ່ກົງກັບຄົນນີ້ (null = ບໍ່ພົບ, ໃຫ້ສ້າງໃໝ່).
 *
 * ລຳດັບການທຽບ: **ເບີໂທກ່ອນ** ເພາະເປັນຕົວລະບຸທີ່ແນ່ນອນກວ່າ
 * ແລ້ວຄ່ອຍທຽບຊື່ Facebook. ຊື່ຊ້ຳກັນໄດ້ ແຕ່ໃນຮ້ານໜຶ່ງໆພໍໃຊ້ໄດ້
 * ແລະ ຜິດພາດທາງນີ້ (ລວມຄົນຊື່ຄືກັນ) ເສຍໜ້ອຍກວ່າການມີລູກຄ້າຊ້ຳເປັນສິບ.
 */
export function findMatchingLead(
  incoming: IncomingPerson,
  candidates: LeadCandidate[],
): LeadCandidate | null {
  const phone = normalizePhone(incoming.phone);
  if (phone) {
    const byPhone = candidates.find((c) => normalizePhone(c.phone) === phone);
    if (byPhone) return byPhone;
  }

  const fbName = normalizeName(incoming.fbName);
  if (fbName) {
    const byFbName = candidates.find((c) => normalizeName(c.fbName) === fbName);
    if (byFbName) return byFbName;
    // ບາງແຖວປ້ອນມືໄວ້ ຊື່ຢູ່ຊ່ອງ `name` ບໍ່ແມ່ນ `fbName`
    const byName = candidates.find((c) => normalizeName(c.name) === fbName);
    if (byName) return byName;
  }

  return null;
}
