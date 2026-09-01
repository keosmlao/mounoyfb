import { formatInt, safeDiv } from "./format";
import { suggestBudgetStep } from "./advice-types";
import type { MoneyFn } from "./money";

/**
 * ວິທີຍິງ ແລະ ບໍລິຫານແຄມເປນ — ຂຽນເປັນ**ກົດທີ່ລະບົບຄິດເອງໄດ້** ບໍ່ແມ່ນຄູ່ມືໃຫ້ອ່ານ.
 *
 * ຫຼັກຄິດທັງໝົດຢືນຢູ່ເທິງຕົວເລກອັນດຽວ:
 *
 *     ຄ່າຕໍ່ຄົນທັກສູງສຸດທີ່ຮັບໄດ້ = ກຳໄລຕໍ່ອໍເດີ × ອັດຕາປິດການຂາຍ
 *
 * ຈ່າຍແພງກວ່ານີ້ = ຂາດທຶນທຸກຄົນທີ່ທັກເຂົ້າມາ ບໍ່ວ່າຍອດຂາຍຈະເບິ່ງຄືດີປານໃດ.
 * ຕົວເລກທັງສອງມາຈາກຂໍ້ມູນຈິງຂອງຮ້ານ (ອໍເດີທີ່ສົ່ງສຳເລັດ + ຄົນທັກຈາກ Facebook)
 * ຈຶ່ງບໍ່ແມ່ນການເດົາ ແລະ ປ່ຽນຕາມຄວາມຈິງເອງ.
 *
 * ຈັງຫວະເວລາກໍ່ເປັນກົດ ບໍ່ແມ່ນຄວາມຮູ້ສຶກ:
 *
 * - **0–3 ວັນ ຫ້າມແຕະ** — Facebook ຍັງຢູ່ຊ່ວງຮຽນຮູ້ ການແກ້ງົບຈະຣີເຊັດໃໝ່ໝົດ
 * - **ຄົນທັກຍັງບໍ່ພໍ ຫ້າມຕັດສິນ** — ຕົວເລກຈາກ 3 ຄົນທັກຄືຄວາມບັງເອີນ
 * - **ແພງກວ່າເປົ້າຕອນຍັງໜຸ່ມ = ປ່ຽນຮູບກ່ອນ** ບໍ່ແມ່ນຕັດຖິ້ມທັນທີ
 * - **ຄຸ້ມແລ້ວຄ່ອຍເພີ່ມງົບເທື່ອລະໜ້ອຍ** — ເພີ່ມແຮງເກີນ = ກັບເຂົ້າຊ່ວງຮຽນຮູ້
 *
 * ໄຟລ໌ນີ້ຕ້ອງບໍລິສຸດ (ຫ້າມ import prisma) ແລະ ມີ test ຄຸມ.
 */

// --------------------------------------------------------------- ເກນ

/** ຊ່ວງຮຽນຮູ້ຂອງ Facebook — ພາຍໃນນີ້ຢ່າໄປແຕະຫຍັງ */
export const LEARNING_DAYS = 3;
/** ຫຼັງຈາກນີ້ຖືວ່າມີເວລາພິສູດພຽງພໍແລ້ວ ຈຶ່ງກ້າຕັດ */
export const DECIDE_DAYS = 7;
/** ຄົນທັກຂັ້ນຕ່ຳກ່ອນຈະຕັດສິນວ່າດີ ຫຼື ບໍ່ດີ */
export const MIN_MESSAGES = 10;
/** ຕ່າງຈາກເປົ້າເທົ່ານີ້ຂຶ້ນໄປຈຶ່ງຄຸ້ມທີ່ຈະລົງມື (ຄືກັບ `advice.ts`) */
export const MEANINGFUL_GAP = 1.4;
/** ງົບຕໍ່ວັນຄວນໄດ້ຄົນທັກປະມານເທົ່ານີ້ ຈຶ່ງອອກຈາກຊ່ວງຮຽນຮູ້ທັນເວລາ */
export const MESSAGES_PER_DAY_TARGET = 5;

// --------------------------------------------------------------- ເປົ້າ

export type Economics = {
  /** ກຳໄລຂັ້ນຕົ້ນຕໍ່ 1 ອໍເດີທີ່ສົ່ງສຳເລັດ (ກີບ) */
  marginPerOrder: number;
  /** ອໍເດີທີ່ສົ່ງສຳເລັດໃນຊ່ວງທີ່ໃຊ້ຄິດ */
  orders: number;
  /** ຄົນທັກໃນຊ່ວງດຽວກັນ */
  messages: number;
};

export type Target = {
  /** ຄ່າຕໍ່ຄົນທັກສູງສຸດທີ່ຮັບໄດ້ (ກີບ) — 0 = ຍັງຄິດບໍ່ໄດ້ */
  costPerMessage: number;
  /** ອັດຕາປິດການຂາຍທີ່ໃຊ້ຄິດ */
  closeRate: number;
  marginPerOrder: number;
  /** ຂາດຫຍັງຈຶ່ງຄິດບໍ່ໄດ້ — null = ຄິດໄດ້ */
  missing: string | null;
};

/**
 * ຄິດເປົ້າຈາກຂໍ້ມູນຈິງ. ຂາດຢ່າງໃດຢ່າງໜຶ່ງແມ່ນບອກໄປຊື່ໆວ່າຂາດຫຍັງ —
 * **ຢ່າເດົາຄ່າແທນ** ເພາະຄົນຈະເອົາເປົ້າປອມໄປຕັດແຄມເປນທີ່ຍັງດີຢູ່.
 */
export function buildTarget(econ: Economics): Target {
  const closeRate = safeDiv(econ.orders, econ.messages);

  let missing: string | null = null;
  if (econ.marginPerOrder <= 0) {
    missing = "ຍັງບໍ່ຮູ້ກຳໄລຕໍ່ອໍເດີ — ຕ້ອງມີອໍເດີທີ່ສົ່ງສຳເລັດພ້ອມລາຄາ ແລະ ຕົ້ນທຶນ";
  } else if (econ.messages <= 0 || econ.orders <= 0) {
    missing = "ຍັງບໍ່ຮູ້ອັດຕາປິດການຂາຍ — ຕ້ອງມີທັງຄົນທັກ ແລະ ອໍເດີໃນຊ່ວງດຽວກັນ";
  }

  return {
    costPerMessage: missing ? 0 : econ.marginPerOrder * closeRate,
    closeRate,
    marginPerOrder: econ.marginPerOrder,
    missing,
  };
}

/**
 * ງົບຕໍ່ວັນທີ່ຄວນຕັ້ງ — ໜ້ອຍເກີນແລ້ວຄົນທັກຢອດລະຄົນ ຈະໃຊ້ເວລາເປັນອາທິດ
 * ກວ່າຈະຮູ້ວ່າດີ ຫຼື ບໍ່ດີ ແລະ Facebook ຈະບໍ່ອອກຈາກຊ່ວງຮຽນຮູ້ຈັກເທື່ອ.
 */
export function suggestDailyBudget(target: Target): number {
  return target.costPerMessage > 0
    ? target.costPerMessage * MESSAGES_PER_DAY_TARGET
    : 0;
}

// --------------------------------------------------------------- ຂັ້ນຕອນ

export type Stage = "learning" | "testing" | "deciding";

export const STAGE_LABEL: Record<Stage, string> = {
  learning: "ຊ່ວງຮຽນຮູ້",
  testing: "ຊ່ວງທົດສອບ",
  deciding: "ຮອດເວລາຕັດສິນ",
};

export function stageOf(ageDays: number): Stage {
  if (ageDays < LEARNING_DAYS) return "learning";
  if (ageDays < DECIDE_DAYS) return "testing";
  return "deciding";
}

// --------------------------------------------------------------- ຄຳສັ່ງ

export type Action = "wait" | "data" | "creative" | "cut" | "scale" | "keep";

export const ACTION_LABEL: Record<Action, { text: string; tone: string }> = {
  wait: { text: "ຢ່າແຕະ", tone: "neutral" },
  data: { text: "ລໍຂໍ້ມູນ", tone: "neutral" },
  creative: { text: "ປ່ຽນຮູບ/ຂໍ້ຄວາມ", tone: "warning" },
  cut: { text: "ຕັດ", tone: "danger" },
  scale: { text: "ເພີ່ມງົບ", tone: "success" },
  keep: { text: "ປະໄວ້ຄືເກົ່າ", tone: "info" },
};

export type CampaignInput = {
  id: string;
  name: string;
  /** ຈຳນວນວັນທີ່ແລ່ນມາແລ້ວ */
  ageDays: number;
  messages: number;
  spendLak: number;
  /** ງົບຕໍ່ວັນທີ່ຕັ້ງໄວ້ (ກີບ) — null = ບໍ່ໄດ້ຕັ້ງ ຫຼື ໃຊ້ງົບລວມ */
  dailyBudget: number | null;
};

export type CampaignPlay = CampaignInput & {
  stage: Stage;
  costPerMessage: number;
  /** ຄ່າຕໍ່ຄົນທັກ ÷ ເປົ້າ — 1.0 = ພໍດີເປົ້າ, ນ້ອຍກວ່າ = ຄຸ້ມ */
  index: number;
  action: Action;
  /** ເຫດຜົນເປັນຕົວເລກ */
  reason: string;
  /** ຕ້ອງລົງມືແນວໃດ */
  next: string;
};

/**
 * ຄຳສັ່ງສຳລັບແຄມເປນດຽວ — ຕາມລຳດັບກົດ ບໍ່ແມ່ນຕາມຄວາມຮູ້ສຶກ.
 * ລຳດັບສຳຄັນ: ເວລາກ່ອນ → ຂໍ້ມູນ → ຄວາມຄຸ້ມ.
 */
export function planCampaign(
  c: CampaignInput,
  target: Target,
  money: MoneyFn,
): CampaignPlay {
  const stage = stageOf(c.ageDays);
  const costPerMessage = safeDiv(c.spendLak, c.messages);
  const index = target.costPerMessage > 0
    ? safeDiv(costPerMessage, target.costPerMessage)
    : 0;

  const base = { ...c, stage, costPerMessage, index };
  const spent = money(c.spendLak);
  const msgs = `${formatInt(c.messages)} ຄົນທັກ`;

  // 1. ຢູ່ຊ່ວງຮຽນຮູ້ — ແກ້ຫຍັງກໍ່ຣີເຊັດການຮຽນຮູ້ໃໝ່ໝົດ
  if (stage === "learning") {
    return {
      ...base,
      action: "wait",
      reason: `ຫາກໍ່ແລ່ນ ${c.ageDays} ວັນ · ${spent} · ${msgs}`,
      next: `ປະໃຫ້ຄົບ ${LEARNING_DAYS} ວັນກ່ອນ — ແກ້ງົບ ຫຼື ປ່ຽນເປົ້າໝາຍຕອນນີ້ Facebook ຈະເລີ່ມຮຽນຮູ້ໃໝ່`,
    };
  }

  // 2. ຍັງບໍ່ຮູ້ເປົ້າ — ບອກໄດ້ແຕ່ຕົວເລກດິບ
  if (target.costPerMessage <= 0) {
    return {
      ...base,
      action: "data",
      reason: `ຄ່າຕໍ່ຄົນທັກ ${money(costPerMessage)} (${spent} · ${msgs})`,
      next: target.missing ?? "ຕ້ອງມີຂໍ້ມູນເພີ່ມຈຶ່ງທຽບກັບເປົ້າໄດ້",
    };
  }

  // 3. ໃຊ້ເງິນໄປແລ້ວແຕ່ບໍ່ມີຄົນທັກເລີຍ — ອັນນີ້ບອກໄດ້ໂດຍບໍ່ຕ້ອງລໍ
  if (c.messages === 0 && c.spendLak >= target.costPerMessage * MIN_MESSAGES) {
    return {
      ...base,
      action: "cut",
      reason: `ໃຊ້ໄປ ${spent} ແຕ່ບໍ່ມີຄົນທັກເລີຍ (ຄວນໄດ້ປະມານ ${formatInt(
        c.spendLak / target.costPerMessage,
      )} ຄົນແລ້ວ)`,
      next: "ປິດແຄມເປນນີ້ ແລ້ວກວດຮູບ/ຂໍ້ຄວາມ ແລະ ປຸ່ມກົດວ່າພາໄປແຊັດແທ້ບໍ່",
    };
  }

  // 4. ຄົນທັກຍັງບາງ — ຫ້າມຕັດສິນ
  if (c.messages < MIN_MESSAGES) {
    return {
      ...base,
      action: "data",
      reason: `ມີແຕ່ ${msgs} (ຕ້ອງການ ${MIN_MESSAGES}) · ${spent}`,
      next:
        stage === "deciding"
          ? `ແລ່ນມາ ${c.ageDays} ວັນແລ້ວແຕ່ຄົນທັກຍັງບາງ — ງົບອາດໜ້ອຍເກີນ ຫຼື ກຸ່ມເປົ້າໝາຍແຄບເກີນ`
          : "ລໍໃຫ້ຄົນທັກຄົບກ່ອນຈຶ່ງຕັດສິນ",
    };
  }

  // 5. ແພງກວ່າເປົ້າຊັດເຈນ
  if (index > MEANINGFUL_GAP) {
    const over = Math.round((index - 1) * 100);
    const reason =
      `ຄ່າຕໍ່ຄົນທັກ ${money(costPerMessage)} ແພງກວ່າເປົ້າ ${money(target.costPerMessage)} ` +
      `ຢູ່ ${over}% (${msgs} · ${spent})`;

    // ຍັງໜຸ່ມ — ຮູບອາດເປັນຕົ້ນເຫດ ລອງປ່ຽນກ່ອນຕັດ
    if (stage === "testing") {
      return {
        ...base,
        action: "creative",
        reason,
        next: `ປ່ຽນຮູບ/ຂໍ້ຄວາມໃໝ່ແລ້ວປະອີກ ${DECIDE_DAYS - c.ageDays} ວັນ — ຢ່າຫາກໍ່ຕັດ ຮູບເປັນຕົ້ນເຫດໄດ້ຫຼາຍກວ່າກຸ່ມເປົ້າໝາຍ`,
      };
    }
    return {
      ...base,
      action: "cut",
      reason,
      next: `ແລ່ນມາ ${c.ageDays} ວັນ ພິສູດພຽງພໍແລ້ວ — ຕັດແລ້ວຍ້າຍງົບໄປແຄມເປນທີ່ຄຸ້ມກວ່າ`,
    };
  }

  // 6. ຄຸ້ມກວ່າເປົ້າຊັດເຈນ — ເພີ່ມງົບເທື່ອລະໜ້ອຍ
  if (index > 0 && index < 1 / MEANINGFUL_GAP) {
    const step = suggestBudgetStep(index);
    return {
      ...base,
      action: "scale",
      reason:
        `ຄ່າຕໍ່ຄົນທັກ ${money(costPerMessage)} ຖືກກວ່າເປົ້າ ${money(target.costPerMessage)} ` +
        `ຢູ່ ${Math.round((1 - index) * 100)}% (${msgs})`,
      next:
        c.dailyBudget && c.dailyBudget > 0
          ? `ເພີ່ມງົບເປັນ ${money(c.dailyBudget * (1 + Number(step.replace("%", "")) / 100))}/ວັນ (+${step}) ແລ້ວປະ 3 ວັນ`
          : `ເພີ່ມງົບເທື່ອລະ ${step} ແລ້ວປະ 3 ວັນ — ເພີ່ມແຮງກວ່ານີ້ Facebook ຈະກັບເຂົ້າຊ່ວງຮຽນຮູ້`,
    };
  }

  // 7. ຢູ່ໃນເກນ — ຢ່າໄປຫຍຸ້ງ
  return {
    ...base,
    action: "keep",
    reason: `ຄ່າຕໍ່ຄົນທັກ ${money(costPerMessage)} ຢູ່ໃນເກນເປົ້າ ${money(target.costPerMessage)} (${msgs})`,
    next: "ບໍ່ຕ້ອງແກ້ຫຍັງ — ການແກ້ຕອນຜົນປົກກະຕິ ມີແຕ່ຈະຣີເຊັດການຮຽນຮູ້ຖິ້ມ",
  };
}

/** ຄຳສັ່ງທີ່ຕ້ອງລົງມືກ່ອນ ຂຶ້ນເທິງສຸດ */
const ACTION_RANK: Record<Action, number> = {
  cut: 0,
  scale: 1,
  creative: 2,
  data: 3,
  wait: 4,
  keep: 5,
};

export function planAll(
  campaigns: CampaignInput[],
  target: Target,
  money: MoneyFn,
): CampaignPlay[] {
  return campaigns
    .map((c) => planCampaign(c, target, money))
    .sort(
      (a, b) =>
        ACTION_RANK[a.action] - ACTION_RANK[b.action] || b.spendLak - a.spendLak,
    );
}

// --------------------------------------------------------------- ຕັ້ງໃໝ່

export type SetupStep = { title: string; detail: string };

/**
 * ຂັ້ນຕອນຕັ້ງແຄມເປນໃໝ່ — ຄ່າຕົວເລກຄິດຈາກເປົ້າຈິງ ບໍ່ແມ່ນຄ່າຄົງທີ່ໃນຄູ່ມື.
 */
export function setupSteps(target: Target, money: MoneyFn): SetupStep[] {
  const budget = suggestDailyBudget(target);

  return [
    {
      title: "1. ຮູ້ເປົ້າກ່ອນຍິງ",
      detail:
        target.costPerMessage > 0
          ? `ຄ່າຕໍ່ຄົນທັກຕ້ອງບໍ່ເກີນ ${money(target.costPerMessage)} — ນີ້ຄືເສັ້ນຂາດທຶນ ບໍ່ແມ່ນເປົ້າໝາຍທີ່ຢາກໄດ້`
          : (target.missing ?? "ຕ້ອງມີຂໍ້ມູນອໍເດີກ່ອນຈຶ່ງຮູ້ເປົ້າ"),
    },
    {
      title: "2. ຕັ້ງງົບໃຫ້ພໍຮູ້ຜົນ",
      detail:
        budget > 0
          ? `ຢ່າງໜ້ອຍ ${money(budget)}/ວັນ (≈ ${MESSAGES_PER_DAY_TARGET} ຄົນທັກ/ວັນ) — ງົບໜ້ອຍກວ່ານີ້ຈະໃຊ້ເວລາເປັນອາທິດກວ່າຈະຮູ້ວ່າດີ ຫຼື ບໍ່`
          : "ຕັ້ງງົບໃຫ້ໄດ້ຄົນທັກຢ່າງໜ້ອຍ 5 ຄົນ/ວັນ ຈຶ່ງຈະຕັດສິນໄດ້ພາຍໃນ 1 ອາທິດ",
    },
    {
      title: "3. 1 ແຄມເປນ = 1 ສິນຄ້າ = 1 ຂໍ້ສະເໜີ",
      detail:
        "ຢ່າຍັດຫຼາຍສິນຄ້າໃສ່ແຄມເປນດຽວ — ຕອນຜົນອອກມາຈະບອກບໍ່ໄດ້ວ່າອັນໃດເປັນຄົນເຮັດໃຫ້ດີ ຫຼື ພັງ",
    },
    {
      title: "4. ຢ່າຫັ່ນກຸ່ມເປົ້າໝາຍຍ່ອຍເກີນ",
      detail:
        "ຫຼາຍຊຸດໂຄສະນາທີ່ຊ້ອນກັນຈະແຍ່ງກັນເອງ ແລະ ແຕ່ລະຊຸດໄດ້ຂໍ້ມູນບາງລົງ — ເລີ່ມດ້ວຍກຸ່ມກວ້າງ 1–2 ຊຸດພໍ",
    },
    {
      title: "5. ຢ່າງໜ້ອຍ 3 ຮູບ/ຂໍ້ຄວາມ",
      detail:
        "ໃຫ້ Facebook ເລືອກເອງວ່າອັນໃດເຂົ້າກັບໃຜ — ແລະ ເມື່ອຜົນຕົກ ຈະໄດ້ຮູ້ວ່າຄົນເບື່ອຮູບ ບໍ່ແມ່ນເບື່ອສິນຄ້າ",
    },
    {
      title: "6. ໃສ່ຄຳຕອບທີ່ຄົນຖາມເລື້ອຍໃສ່ໂຄສະນາເລີຍ",
      detail:
        "ລາຄາ · ຄ່າສົ່ງ · ສີ/ຂະໜາດ — ເບິ່ງໜ້າ ພຶດຕິກຳລູກຄ້າ ວ່າຄົນຖາມຫຍັງຫຼາຍສຸດ ແລ້ວຕອບໄວ້ກ່ອນ ຈະຫຼຸດຄົນທັກທີ່ບໍ່ຊື້",
    },
    {
      title: `7. ບໍ່ແຕະຫຍັງ ${LEARNING_DAYS} ວັນທຳອິດ`,
      detail:
        "ທຸກການແກ້ງົບ ຫຼື ເປົ້າໝາຍ ຈະເຮັດໃຫ້ Facebook ເລີ່ມຮຽນຮູ້ໃໝ່ ແລ້ວເງິນທີ່ຈ່າຍໄປແລ້ວກໍ່ເສຍລ້າ",
    },
  ];
}
