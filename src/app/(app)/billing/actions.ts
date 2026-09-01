"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth-server";
import { refreshAdAccountBilling } from "@/lib/fb";

/**
 * ດຶງຍອດຄ້າງຊຳລະຂອງທຸກບັນຊີດຽວນີ້ (1 request ຫາ Facebook).
 *
 * ຮອບດຶງປົກກະຕິອັບເດດໃຫ້ຢູ່ແລ້ວ — ປຸ່ມນີ້ໄວ້ໃຊ້ຕອນຢາກເຫັນຕົວເລກ**ດຽວນີ້**
 * ກ່ອນຈະໄປຈ່າຍເງິນ ໂດຍບໍ່ຕ້ອງລໍຮອບຕໍ່ໄປ ຫຼື ດຶງຜົນລາຍວັນທັງໝົດຄືນ.
 */
export async function refreshBillingNow() {
  await requireSession();
  await refreshAdAccountBilling();
  revalidatePath("/billing");
  // ແຖບ "ຄ້າງຊຳລະ" ຢູ່ໜ້າຫຼັກອ່ານຄ່າດຽວກັນ
  revalidatePath("/");
}
