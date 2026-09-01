/**
 * ຄິວວຽກຂອງກ່ອງຂໍ້ຄວາມ — "ໃຜລໍຢູ່ · ລໍດົນປານໃດ · ຍັງຕອບໄດ້ອີກຈັກຊົ່ວໂມງ".
 *
 * ບັນຫາທີ່ໄຟລ໌ນີ້ແກ້: `FbThread.waitingReply` ອີງແຕ່ວ່າ**ຂໍ້ຄວາມສຸດທ້າຍ
 * ມາຈາກເພຈບໍ່** ຈຶ່ງໃຊ້ບໍ່ໄດ້ເມື່ອເພຈເປີດ **ຕອບອັດຕະໂນມັດ** ໄວ້ —
 * ບອດຕອບພາຍໃນວິນາທີ ແລ້ວທຸກຫ້ອງຈະເບິ່ງຄື "ຕອບແລ້ວ" ທັງທີ່ຍັງບໍ່ມີຄົນເບິ່ງເລີຍ.
 *
 * ບ່ອນນີ້ຈຶ່ງນັບໃໝ່ຈາກຂໍ້ຄວາມຈິງ: ຂໍ້ຄວາມຂອງເພຈທີ່ຕອບ**ໄວກວ່າ
 * `AUTO_REPLY_SECONDS`** ຖືວ່າເປັນບອດ ບໍ່ນັບເປັນການຕອບຂອງຄົນ.
 *
 * ⚠️ Facebook ໃຫ້ຕອບພາຍໃນ **24 ຊົ່ວໂມງ** ນັບຈາກຂໍ້ຄວາມສຸດທ້າຍຂອງລູກຄ້າ —
 * ເກີນນັ້ນສົ່ງບໍ່ໄດ້ອີກ ຈຶ່ງເປັນເສັ້ນຕາຍຈິງ ບໍ່ແມ່ນເປົ້າໝາຍພາຍໃນ.
 *
 * ໄຟລ໌ນີ້ຕ້ອງບໍລິສຸດ (ຫ້າມ import prisma) ແລະ ມີ test ຄຸມ.
 */

/**
 * ຕອບໄວກວ່ານີ້ຖືວ່າເປັນບອດ. ຄົນທີ່ພິມເອງໃຊ້ເວລາອ່ານ + ພິມ —
 * ຕ່ຳກວ່າ 30 ວິນາທີ ແທບເປັນໄປບໍ່ໄດ້ ເຖິງຈະໃຊ້ຄຳຕອບສຳເລັດຮູບ.
 */
export const AUTO_REPLY_SECONDS = 30;

/** ໜ້າຕ່າງທີ່ Facebook ອະນຸຍາດໃຫ້ຕອບ (ຊົ່ວໂມງ) */
export const REPLY_WINDOW_HOURS = 24;

/** ເຫຼືອໜ້ອຍກວ່ານີ້ຖືວ່າດ່ວນ (ຊົ່ວໂມງ) */
export const URGENT_HOURS = 2;

export type QueueMessage = {
  fromPage: boolean;
  sentAt: Date;
};

export type ThreadInput = {
  id: string;
  personName: string | null;
  pageName: string;
  snippet: string | null;
  assignee: string | null;
  handled: boolean;
  leadId: string | null;
  /** ຂໍ້ຄວາມຂອງຫ້ອງນີ້ ຮຽງເກົ່າ → ໃໝ່ */
  messages: QueueMessage[];
};

export type Urgency = "expired" | "urgent" | "soon" | "ok";

export type QueueRow = {
  id: string;
  personName: string | null;
  pageName: string;
  snippet: string | null;
  assignee: string | null;
  leadId: string | null;
  /** ເວລາທີ່ລູກຄ້າຖາມມາ ແລ້ວຍັງບໍ່ມີຄົນຕອບ */
  waitingSince: Date;
  /** ລໍມາແລ້ວຈັກນາທີ */
  waitedMinutes: number;
  /** ເຫຼືອອີກຈັກນາທີຈຶ່ງໝົດສິດຕອບ (ຕິດລົບ = ໝົດແລ້ວ) */
  minutesLeft: number;
  urgency: Urgency;
  /** ບອດຕອບໄປແລ້ວ ແຕ່ຍັງບໍ່ມີຄົນຕອບ */
  autoRepliedOnly: boolean;
};

function minutesBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 60_000);
}

/**
 * ຂໍ້ຄວາມຂອງເພຈອັນນີ້ ເປັນການຕອບຂອງ**ຄົນ**ບໍ່ —
 * ຕອບໄວກວ່າ `AUTO_REPLY_SECONDS` ຫຼັງລູກຄ້າພິມມາ ຖືວ່າເປັນບອດ.
 */
export function isHumanReply(
  reply: QueueMessage,
  customerAt: Date | null,
): boolean {
  if (!reply.fromPage) return false;
  if (!customerAt) return true;
  const seconds = (reply.sentAt.getTime() - customerAt.getTime()) / 1000;
  return seconds >= AUTO_REPLY_SECONDS;
}

/**
 * ຫ້ອງນີ້ຍັງລໍຄົນຕອບຢູ່ບໍ່ — ຄືນເວລາຂອງຂໍ້ຄວາມລູກຄ້າທີ່ຍັງບໍ່ໄດ້ຮັບການຕອບ
 * ຈາກຄົນ (null = ຕອບແລ້ວ ຫຼື ບໍ່ມີຂໍ້ຄວາມຂອງລູກຄ້າເລີຍ).
 */
export function waitingSince(messages: QueueMessage[]): {
  since: Date | null;
  autoRepliedOnly: boolean;
} {
  let since: Date | null = null;
  let autoReplied = false;

  for (const m of messages) {
    if (!m.fromPage) {
      // ລູກຄ້າພິມມາໃໝ່ — ເລີ່ມນັບຄືນ (ຂໍ້ຄວາມຕິດກັນຫຼາຍອັນ ນັບອັນທຳອິດ)
      if (!since) {
        since = m.sentAt;
        autoReplied = false;
      }
      continue;
    }
    if (!since) continue;
    if (isHumanReply(m, since)) {
      since = null;
      autoReplied = false;
    } else {
      // ບອດຕອບ — ຍັງຖືວ່າລູກຄ້າລໍຄົນຢູ່
      autoReplied = true;
    }
  }

  return { since, autoRepliedOnly: since !== null && autoReplied };
}

export function urgencyOf(minutesLeft: number): Urgency {
  if (minutesLeft <= 0) return "expired";
  if (minutesLeft <= URGENT_HOURS * 60) return "urgent";
  if (minutesLeft <= 6 * 60) return "soon";
  return "ok";
}

export const URGENCY_LABEL: Record<Urgency, { text: string; tone: string }> = {
  expired: { text: "ໝົດເວລາຕອບ", tone: "neutral" },
  urgent: { text: "ດ່ວນ", tone: "danger" },
  soon: { text: "ໃກ້ຮອດ", tone: "warning" },
  ok: { text: "ຍັງມີເວລາ", tone: "success" },
};

/**
 * ຄິວວຽກ — ຫ້ອງທີ່ຍັງລໍຄົນຕອບ ຮຽງ**ຄົນທີ່ລໍດົນສຸດຂຶ້ນກ່ອນ**
 * (ບໍ່ແມ່ນຫ້ອງທີ່ມີຂໍ້ຄວາມໃໝ່ສຸດ ຄືລາຍການປົກກະຕິ) —
 * ຄົນທີ່ລໍດົນສຸດຄືຄົນທີ່ໃກ້ຈະຫາຍໄປຫາຄູ່ແຂ່ງທີ່ສຸດ.
 */
export function buildQueue(
  threads: ThreadInput[],
  now: Date = new Date(),
): QueueRow[] {
  const rows: QueueRow[] = [];

  for (const t of threads) {
    if (t.handled) continue;
    const { since, autoRepliedOnly } = waitingSince(t.messages);
    if (!since) continue;

    const waitedMinutes = minutesBetween(since, now);
    const minutesLeft = REPLY_WINDOW_HOURS * 60 - waitedMinutes;

    rows.push({
      id: t.id,
      personName: t.personName,
      pageName: t.pageName,
      snippet: t.snippet,
      assignee: t.assignee,
      leadId: t.leadId,
      waitingSince: since,
      waitedMinutes,
      minutesLeft,
      urgency: urgencyOf(minutesLeft),
      autoRepliedOnly,
    });
  }

  // ລໍດົນສຸດຂຶ້ນກ່ອນ — ຫ້ອງທີ່ໝົດເວລາແລ້ວໄປທ້າຍສຸດ ເພາະຕອບບໍ່ໄດ້ອີກ
  return rows.sort((a, b) => {
    const aDead = a.urgency === "expired";
    const bDead = b.urgency === "expired";
    if (aDead !== bDead) return aDead ? 1 : -1;
    return b.waitedMinutes - a.waitedMinutes;
  });
}

export type QueueSummary = {
  total: number;
  urgent: number;
  expired: number;
  unassigned: number;
  /** ລໍດົນສຸດ (ນາທີ) */
  longestWait: number;
  /** ຫ້ອງທີ່ມີແຕ່ບອດຕອບ — ສັນຍານວ່າຕອບອັດຕະໂນມັດກຳລັງບັງວຽກຄ້າງໄວ້ */
  autoRepliedOnly: number;
};

export function summarize(rows: QueueRow[]): QueueSummary {
  return {
    total: rows.length,
    urgent: rows.filter((r) => r.urgency === "urgent").length,
    expired: rows.filter((r) => r.urgency === "expired").length,
    unassigned: rows.filter((r) => !r.assignee).length,
    longestWait: rows.reduce((max, r) => Math.max(max, r.waitedMinutes), 0),
    autoRepliedOnly: rows.filter((r) => r.autoRepliedOnly).length,
  };
}

/** "3 ຊົ່ວໂມງ 20 ນາທີ" — ອ່ານໄວກວ່າຕົວເລກນາທີດຽວ */
export function durationLao(minutes: number): string {
  const abs = Math.abs(Math.round(minutes));
  if (abs < 60) return `${abs} ນາທີ`;
  const hours = Math.floor(abs / 60);
  const rest = abs % 60;
  if (hours < 24) {
    return rest > 0 ? `${hours} ຊົ່ວໂມງ ${rest} ນາທີ` : `${hours} ຊົ່ວໂມງ`;
  }
  const days = Math.floor(hours / 24);
  return `${days} ວັນ ${hours % 24} ຊົ່ວໂມງ`;
}
