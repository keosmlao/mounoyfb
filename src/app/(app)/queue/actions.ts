"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/auth-server";

/**
 * ຮັບ / ປ່ອຍ ວຽກຂອງຫ້ອງແຊັດ.
 *
 * `assignee` ເປັນ**ຂອງຄົນ** ຄືກັນກັບ `handled` — ຮອບດຶງຈາກ Facebook
 * ຫ້າມທັບ (ເບິ່ງ `AGENTS.md`). ບ່ອນນີ້ຈຶ່ງແກ້ສະເພາະຊ່ອງນັ້ນຊ່ອງດຽວ.
 *
 * ບໍ່ບັນທຶກລົງ `AuditLog` — ບັນທຶກນັ້ນເອົາໄວ້ສະເພາະສິ່ງທີ່ກູ້ຄືນບໍ່ໄດ້
 * ຫຼື ມີຜົນກັບເງິນ ສ່ວນການຮັບວຽກກົດຄືນໄດ້ຕະຫຼອດ.
 */

/** ຮັບວຽກເປັນຂອງຕົນເອງ — ຕ້ອງ login ດ້ວຍບັນຊີຜູ້ໃຊ້ຈຶ່ງຮູ້ວ່າແມ່ນໃຜ */
export async function claimThread(threadId: string) {
  const me = await currentUser();
  if (!me) {
    throw new Error(
      "ຕ້ອງເຂົ້າລະບົບດ້ວຍບັນຊີຜູ້ໃຊ້ຈຶ່ງຮັບວຽກໄດ້ — ສ້າງຜູ້ໃຊ້ຢູ່ໜ້າ ຕັ້ງຄ່າ",
    );
  }

  await prisma.fbThread.update({
    where: { id: threadId },
    data: { assignee: me.displayName },
  });
  revalidatePath("/queue");
}

/** ປ່ອຍວຽກຄືນເຂົ້າຄິວ */
export async function releaseThread(threadId: string) {
  await prisma.fbThread.update({
    where: { id: threadId },
    data: { assignee: null },
  });
  revalidatePath("/queue");
}
