/**
 * ແລ່ນເທື່ອດຽວຕອນເຊີບເວີຂຶ້ນ (Next.js `instrumentation`).
 *
 * ໃຊ້ຕັ້ງຕົວດຶງຂໍ້ມູນອັດຕະໂນມັດ — ຕົວມັນເອງບໍ່ດຶງຫຍັງ ຖ້າຍັງບໍ່ໄດ້ເປີດໃນໜ້າ
 * ຕັ້ງຄ່າ. `register` ຖືກເອີ້ນທັງ runtime nodejs ແລະ edge ຈຶ່ງຕ້ອງກັນໄວ້
 * ເພາະ prisma ໃຊ້ໄດ້ສະເພາະ nodejs.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startAutoSyncScheduler } = await import("@/lib/auto-sync");
  startAutoSyncScheduler();
}
