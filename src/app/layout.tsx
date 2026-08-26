import type { Metadata } from "next";
import { Noto_Sans_Lao } from "next/font/google";
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

/**
 * layout ນອກສຸດ — ມີແຕ່ໂຄງ html/font ເທົ່ານັ້ນ
 * ເພື່ອໃຫ້ໜ້າ /login ສະແດງເຕັມຈໍໂດຍບໍ່ມີເມນູຂ້າງ.
 * ເມນູ ແລະ ໂຄງແອັບຢູ່ `(app)/layout.tsx` ຊຶ່ງຄຸມທຸກໜ້າທີ່ຕ້ອງ login ກ່ອນ.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="lo" className={`${notoLao.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
