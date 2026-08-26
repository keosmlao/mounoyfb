import { Sidebar } from "@/components/Sidebar";
import { buildAlerts, countActionable } from "@/lib/alerts";

/** ນັບການແຈ້ງເຕືອນໃສ່ເມນູ — ຖ້າຖານຂໍ້ມູນຍັງບໍ່ພ້ອມ ໃຫ້ສະແດງໜ້າໄດ້ຕາມປົກກະຕິ */
async function alertBadgeCount(): Promise<number> {
  try {
    return countActionable(await buildAlerts());
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
  const alertCount = await alertBadgeCount();

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <Sidebar alertCount={alertCount} />
      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
