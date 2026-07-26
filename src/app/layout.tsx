import type { Metadata } from "next";
import { Noto_Sans_Lao } from "next/font/google";
import { Sidebar } from "@/components/Sidebar";
import { buildAlerts, countActionable } from "@/lib/alerts";
import "./globals.css";

const notoLao = Noto_Sans_Lao({
  variable: "--font-lao",
  subsets: ["lao", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "FBMONOY — ລະບົບຈັດການການຍິງໂຄສະນາ Facebook",
  description:
    "ຈັດການແຄມເປນ, ບັນທຶກຄ່າໂຄສະນາລາຍວັນ, ຕິດຕາມລູກຄ້າ ແລະ ວັດຜົນ ROAS",
};

/** ນັບການແຈ້ງເຕືອນໃສ່ເມນູ — ຖ້າຖານຂໍ້ມູນຍັງບໍ່ພ້ອມ ໃຫ້ສະແດງໜ້າໄດ້ຕາມປົກກະຕິ */
async function alertBadgeCount(): Promise<number> {
  try {
    return countActionable(await buildAlerts());
  } catch {
    return 0;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const alertCount = await alertBadgeCount();

  return (
    <html lang="lo" className={`${notoLao.variable} h-full antialiased`}>
      <body className="min-h-full">
        <div className="flex min-h-dvh flex-col lg:flex-row">
          <Sidebar alertCount={alertCount} />
          <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
