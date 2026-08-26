/**
 * ໂຄງຂອງຄຳແນະນຳ — ແຍກໄຟລ໌ໄວ້ເພື່ອໃຫ້ `advice.ts` ກັບ `advice-rules.ts`
 * ໃຊ້ຮ່ວມກັນໄດ້ໂດຍບໍ່ import ວົນກັນ.
 */

export type AdviceKind = "cut" | "scale" | "shift" | "watch" | "wait" | "info";

/**
 * ຄວາມໝັ້ນໃຈ — ອີງຈາກວ່າຂໍ້ມູນທີ່ໃຊ້ຕັດສິນມີຫຼາຍກວ່າຂັ້ນຕ່ຳຈັກເທົ່າ.
 * ບອກໄວ້ໃຫ້ຄົນຕັດສິນເອງວ່າຈະລົງມືທັນທີ ຫຼື ລໍເບິ່ງອີກສອງສາມວັນ.
 */
export type Confidence = "high" | "medium" | "low";

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: "ໝັ້ນໃຈສູງ",
  medium: "ໝັ້ນໃຈປານກາງ",
  low: "ຂໍ້ມູນຍັງບາງ",
};

/** ຂໍ້ມູນຫຼາຍກວ່າຂັ້ນຕ່ຳ 3 ເທົ່າ = ສູງ, 1.5 ເທົ່າ = ປານກາງ, ນອກນັ້ນ = ບາງ */
export function confidenceFrom(observed: number, minimum: number): Confidence {
  if (minimum <= 0) return "low";
  const ratio = observed / minimum;
  if (ratio >= 3) return "high";
  if (ratio >= 1.5) return "medium";
  return "low";
}

export type Advice = {
  id: string;
  kind: AdviceKind;
  title: string;
  /** ເຫດຜົນເປັນຕົວເລກ — ຕ້ອງກວດຄືນໄດ້ສະເໝີ */
  reason: string;
  /** ຜົນທີ່ຄາດວ່າຈະໄດ້ ຫຼື ວິທີລົງມື */
  impact?: string;
  confidence: Confidence;
  /** ຂໍ້ມູນທີ່ໃຊ້ຕັດສິນ (sample size) — ບອກໄວ້ໃຫ້ຄົນຊັ່ງນ້ຳໜັກເອງ */
  sample: string;
  href?: string;
};

export const ADVICE_TONE: Record<
  AdviceKind,
  { label: string; tone: string; icon: string }
> = {
  cut: { label: "ຄວນຕັດ", tone: "danger", icon: "▼" },
  scale: { label: "ຄວນເພີ່ມ", tone: "success", icon: "▲" },
  shift: { label: "ຄວນຍ້າຍ", tone: "warning", icon: "⇄" },
  watch: { label: "ຄວນເຝົ້າເບິ່ງ", tone: "info", icon: "◷" },
  wait: { label: "ລໍຂໍ້ມູນ", tone: "neutral", icon: "⋯" },
  info: { label: "ຂໍ້ສັງເກດ", tone: "neutral", icon: "·" },
};

export function adviceTone(kind: AdviceKind) {
  return ADVICE_TONE[kind];
}

/**
 * ຄວນເພີ່ມງົບຈັກ % — ຄຸ້ມກວ່າຫຼາຍກໍ່ເພີ່ມໄດ້ຫຼາຍ ແຕ່ **ເພດານ 30%**
 * ເພາະການປ່ຽນງົບແຮງເກີນຈະເຮັດໃຫ້ Facebook ກັບເຂົ້າຊ່ວງຮຽນຮູ້ໃໝ່
 * ແລ້ວຜົນທີ່ດີຢູ່ຈະຫາຍໄປ.
 */
export function suggestBudgetStep(costIndex: number): string {
  if (costIndex <= 0) return "20%";
  const advantage = 1 / costIndex - 1; // ຄຸ້ມກວ່າສະເລ່ຍຈັກເທົ່າ
  const step = Math.min(0.3, Math.max(0.1, advantage / 2));
  return `${Math.round(step * 100)}%`;
}
