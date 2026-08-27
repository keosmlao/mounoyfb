import { SideNav } from "@/components/SideNav";
import { buildAlerts, countActionable } from "@/lib/alerts";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { currentUser, isAuthenticated } from "@/lib/auth-server";

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
  // ດ່ານທີສອງຫຼັງ `proxy.ts` — ບ່ອນນີ້ຮູ້ຈັກຖານຂໍ້ມູນ ຈຶ່ງກວດໄດ້ວ່າ
  // ບັນຊີຍັງເປີດຢູ່ບໍ່ (ຄົນທີ່ຖືກປິດຕ້ອງອອກທັນທີ ບໍ່ແມ່ນລໍ cookie ໝົດອາຍຸ)
  if (!(await isAuthenticated())) redirect("/login");

  const [alertCount, inboxCount, me] = await Promise.all([
    alertBadgeCount(),
    inboxBadgeCount(),
    currentUser(),
  ]);

  return (
    // ຄອມ: ເນື້ອຫາເລີ່ມຫຼັງແຖບຂ້າງ · ມືຖື: ເຕັມຈໍ ແລ້ວເວັ້ນລຸ່ມໃຫ້ແຖບນຳທາງ
    <div className="app-shell min-h-dvh lg:pl-[var(--rail)]">
      <SideNav
        alertCount={alertCount}
        inboxCount={inboxCount}
        userName={me?.displayName ?? null}
      />
      {/* ບໍ່ຈຳກັດຄວາມກວ້າງ — ຈໍກວ້າງເທົ່າໃດ ກໍ່ໃຫ້ຕາຕະລາງໃຊ້ໄດ້ໝົດ */}
      <main className="min-w-0 px-2 pb-24 pt-3 sm:px-3 lg:px-3 lg:pb-5 lg:pt-3">
        {children}
      </main>
    </div>
  );
}
