import { detectIntents } from "./behavior";
import type { ClaimState } from "./live-cf";

/**
 * ຈັດການ comment ທັງໝົດຂອງ live (ບໍ່ແມ່ນແຕ່ CF) — ບໍລິສຸດ · ມີ test ຄຸມ.
 * ການອ່ານ/ຂຽນ ແລະ ຮ້ອງ Facebook ຢູ່ `live-server.ts`.
 */

// ---------------------------------------------------------------- ຈັດປະເພດ

export type SpamReason = "link" | "phone";

export type CommentClass = {
  question: boolean;
  spam: SpamReason | null;
};

/** ຄຳລົງທ້າຍທີ່ເປັນຄຳຖາມ — "ມີສີແດງບໍ່" / "ยังมีไหม" */
const QUESTION_ENDINGS = /(\?|？|ບໍ|ບໍ່|ບໍ໋|ມັ້ຍ|ມັ້ຍໜໍ|ບໍລະ|ไหม|มั้ย|หรอ)\s*[!.~🙏]*\s*$/u;

const LINK = /(https?:\/\/|www\.|\b(?:wa|m|line)\.me\b|\bbit\.ly\b|\b[a-z0-9-]{2,}\.(?:com|net|la|shop|link|store|co)\b)/i;

/**
 * ຈັດປະເພດ comment.
 *
 * - **ຄຳຖາມ** ໃຊ້ຄຳຊຸດດຽວກັບໜ້າພຶດຕິກຳລູກຄ້າ (`behavior.ts`) ຍົກເວັ້ນ "ຈະເອົາ/ຈອງ"
 *   ຊຶ່ງບໍ່ແມ່ນຄຳຖາມ + ປະໂຫຍກທີ່ລົງທ້າຍແບບຖາມ. CF ບໍ່ນັບເປັນຄຳຖາມ.
 * - **ກວນ** = ມີລິ້ງ ຫຼື ເບີໂທ. ເບີໂທຂອງລູກຄ້າເອງກໍ່ຖືກນັບ — ການເຊື່ອງບໍ່ລຶບ
 *   (ເຈົ້າຂອງ comment ແລະ ເພຈຍັງເຫັນ) ແຕ່ຄົນອື່ນໃນ live ຈະບໍ່ເຫັນເບີຂອງລາວ.
 */
export function classifyLiveComment(
  message: string | null | undefined,
  isCf: boolean,
): CommentClass {
  const text = (message ?? "").trim();
  if (!text) return { question: false, spam: null };

  let spam: SpamReason | null = null;
  if (LINK.test(text)) spam = "link";
  else if (hasPhone(text)) spam = "phone";

  const intents = detectIntents([text]).filter((key) => key !== "buy");
  const question = !isCf && (intents.length > 0 || QUESTION_ENDINGS.test(text));

  return { question, spam };
}

/** ຕົວເລກຕິດກັນ 8 ຫຼັກຂຶ້ນໄປ (ຍອມໃຫ້ມີຍະຫວ່າງ/ຂີດຄັ່ນ) = ເບີໂທ */
function hasPhone(text: string): boolean {
  const ascii = text
    .replace(/[໐-໙]/g, (d) => String(d.charCodeAt(0) - 0x0ed0))
    .replace(/[๐-๙]/g, (d) => String(d.charCodeAt(0) - 0x0e50));
  for (const run of ascii.match(/\+?\d[\d\s.-]{6,}\d/g) ?? []) {
    if (run.replace(/\D/g, "").length >= 8) return true;
  }
  return false;
}

export const SPAM_LABEL: Record<SpamReason, string> = {
  link: "ມີລິ້ງ",
  phone: "ມີເບີໂທ",
};

// ------------------------------------------------------------ ຕອບຮັບ CF

export type AckLine = {
  code: string | null;
  quantity: number;
  state: ClaimState;
  /** ລຳດັບຄິວ — ມີສະເພາະ WAITLIST */
  position?: number;
};

/**
 * ຂໍ້ຄວາມຕອບຮັບໃຕ້ comment CF — 1 comment = 1 ຄຳຕອບ ເຖິງຈອງຫຼາຍລະຫັດ.
 * ຄືນ null = ບໍ່ຕ້ອງຕອບ (CF ຊ້ຳ/ຍົກເລີກທັງໝົດ — ຕອບໄປມີແຕ່ຈະສັບສົນ).
 */
export function ackMessage(lines: readonly AckLine[]): string | null {
  const parts: string[] = [];
  let reserved = false;

  for (const line of lines) {
    if (line.state === "RESERVED") {
      parts.push(`✅ ຮັບ ${line.code} ×${line.quantity} ແລ້ວ`);
      reserved = true;
    } else if (line.state === "WAITLIST") {
      parts.push(`⏳ ${line.code} ໝົດແລ້ວ — ທ່ານຢູ່ຄິວ #${line.position ?? "?"}`);
    } else if (line.state === "UNMATCHED") {
      parts.push("❓ ບໍ່ພົບລະຫັດນີ້ — ພິມ CF ຕາມດ້ວຍລະຫັດສິນຄ້າ ເຊັ່ນ CF A1");
    }
  }

  if (parts.length === 0) return null;
  if (reserved) parts.push("ສະຫຼຸບຍອດຈະສົ່ງເຂົ້າ inbox ຫຼັງຈົບ live 🙏");
  return parts.join("\n");
}

/** ຕອບຮັບສະເພາະ comment ທີ່ຫາກໍ່ມາ — backlog ເກົ່າຕອບໄປລູກຄ້າກໍ່ບໍ່ໄດ້ອ່ານແລ້ວ */
export const ACK_MAX_AGE_MS = 5 * 60_000;
/** ຕອບຮັບບໍ່ເກີນນີ້ຕໍ່ນາທີຕໍ່ live — ຕອບຖີ່ເກີນ Facebook ອາດເຫັນເປັນ spam */
export const ACK_PER_MINUTE = 20;
/** ເຊື່ອງອັດຕະໂນມັດສະເພາະ comment ໃໝ່ — ເປີດສະວິດກາງ live ບໍ່ໄລ່ເຊື່ອງຍ້ອນຫຼັງ */
export const AUTO_HIDE_MAX_AGE_MS = 30 * 60_000;
