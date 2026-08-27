import "server-only";

import { prisma } from "./prisma";
import { currentUser } from "./auth-server";

/**
 * ບັນທຶກການກະທຳທີ່ **ກູ້ຄືນບໍ່ໄດ້ ຫຼື ມີຜົນກັບເງິນ**.
 *
 * ບໍ່ບັນທຶກທຸກຢ່າງ — ບັນທຶກໝົດແລ້ວຈະບໍ່ມີໃຜອ່ານ ແລະ ຂອງສຳຄັນຈະຈົມ.
 * ເອົາສະເພາະ: ການລຶບ · ການສັ່ງໄປ Facebook · ການປ່ຽນຄ່າຕັ້ງສຳຄັນ.
 *
 * **ຫ້າມເຮັດໃຫ້ວຽກຫຼັກລົ້ມ** — ຖ້າຂຽນບັນທຶກບໍ່ໄດ້ ກໍ່ຍັງຕ້ອງໃຫ້ຄົນລຶບ
 * ຫຼື ແກ້ຂໍ້ມູນສຳເລັດຢູ່ດີ ຈຶ່ງກືນຄວາມຜິດພາດໄວ້ພາຍໃນ.
 */
export type AuditAction =
  | "campaign.delete"
  | "campaign.update"
  | "campaign.status"
  | "adset.delete"
  | "ad.delete"
  | "order.delete"
  | "lead.delete"
  | "product.delete"
  | "adaccount.delete"
  | "fbpage.delete"
  | "settings.token"
  | "settings.user";

export async function recordAudit(
  action: AuditAction,
  target?: string | null,
  detail?: string | null,
): Promise<void> {
  try {
    const user = await currentUser();
    await prisma.auditLog.create({
      data: {
        userId: user?.id ?? null,
        // ຮ້ານທີ່ຍັງໃຊ້ລະຫັດຮ່ວມກັນ ບອກໄດ້ແຕ່ວ່າ "ມີຄົນເຮັດ" ບໍ່ຮູ້ວ່າໃຜ
        userName: user?.displayName ?? "(ລະຫັດຜ່ານຮ່ວມ)",
        action,
        target: target ?? null,
        detail: detail ?? null,
      },
    });
  } catch (error) {
    console.error("[audit]", action, error);
  }
}

/** ຄຳອ່ານພາສາລາວຂອງແຕ່ລະການກະທຳ */
export const AUDIT_LABEL: Record<string, string> = {
  "campaign.delete": "ລຶບແຄມເປນ",
  "campaign.update": "ແກ້ໄຂແຄມເປນ",
  "campaign.status": "ຢຸດ / ໃຫ້ຍິງຕໍ່",
  "adset.delete": "ລຶບຊຸດໂຄສະນາ",
  "ad.delete": "ລຶບໂຄສະນາ",
  "order.delete": "ລຶບ Order",
  "lead.delete": "ລຶບລູກຄ້າ",
  "product.delete": "ລຶບສິນຄ້າ",
  "adaccount.delete": "ລຶບບັນຊີໂຄສະນາ",
  "fbpage.delete": "ລຶບເພຈ",
  "settings.token": "ປ່ຽນ token / ຄ່າເຊື່ອມຕໍ່",
  "settings.user": "ຈັດການຜູ້ໃຊ້",
};

/** ການກະທຳທີ່ຄວນເດັ່ນເປັນສີແດງ — ພວກທີ່ກູ້ຄືນບໍ່ໄດ້ */
export function isDestructive(action: string): boolean {
  return action.endsWith(".delete");
}
