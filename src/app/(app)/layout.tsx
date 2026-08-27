import { Sidebar } from "@/components/Sidebar";
import { buildAlerts, countActionable } from "@/lib/alerts";
import { prisma } from "@/lib/prisma";

/** ນັບການແຈ້ງເຕືອນໃສ່ເມນູ — ຖ້າຖານຂໍ້ມູນຍັງບໍ່ພ້ອມ ໃຫ້ສະແດງໜ້າໄດ້ຕາມປົກກະຕິ */
async function alertBadgeCount(): Promise<number> {
  try {
    return countActionable(await buildAlerts());
  } catch {
    return 0;
  }
}

/** ວຽກຄ້າງໃນກ່ອງຂໍ້ຄວາມ = comment ທີ່ຍັງບໍ່ຈັດການ + ຫ້ອງແຊັດທີ່ລໍຄຳຕອບ */
async function inboxBadgeCount(): Promise<number> {
  try {
    const [comments, threads] = await Promise.all([
      prisma.fbComment.count({ where: { handled: false, fromPage: false } }),
      prisma.fbThread.count({ where: { waitingReply: true, handled: false } }),
    ]);
    return comments + threads;
  } catch {
    return 0;
  }
}

/**
 * ໂຄງຂອງແອັບ (ເມນູຂ້າງ + ພື້ນທີ່ເນື້ອຫາ) — ຄຸມທຸກໜ້າທີ່ຕ້ອງ login ກ່ອນ.
 * ດ່ານກວດ login ຈິງຢູ່ `src/proxy.ts` ຊຶ່ງແລ່ນກ່ອນຮອດບ່ອນນີ້.
 */
export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [alertCount, inboxCount] = await Promise.all([
    alertBadgeCount(),
    inboxBadgeCount(),
  ]);

  return (
    <div className="app-shell flex min-h-dvh flex-col lg:flex-row">
      <Sidebar alertCount={alertCount} inboxCount={inboxCount} />
      <main className="min-w-0 flex-1 px-3 pb-24 pt-4 sm:px-5 lg:px-6 lg:py-6 lg:pb-10">
        <div className="mx-auto w-full max-w-[1600px]">{children}</div>
      </main>
    </div>
  );
}
