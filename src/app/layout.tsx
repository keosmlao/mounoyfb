import type { Metadata, Viewport } from "next";
import { Noto_Sans_Lao } from "next/font/google";
import "./globals.css";

const notoLao = Noto_Sans_Lao({
  variable: "--font-lao",
  subsets: ["lao", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

/**
 * `viewportFit: "cover"` ຈຳເປັນ — ຖ້າບໍ່ໃສ່ `env(safe-area-inset-*)` ຈະເປັນ 0
 * ສະເໝີໃນ iPhone ທີ່ມີຕິ່ງ/ແຖບລຸ່ມ ແລ້ວແຖບນຳທາງລຸ່ມຈໍຈະຖືກແຖບ home ບັງ.
 *
 * ລັອກການຢິບຊູມຕາມທີ່ຜູ້ໃຊ້ຂໍ. ໝາຍເຫດ: Android Chrome ເຊື່ອຟັງ
 * `userScalable:false` ແຕ່ **iOS Safari ບໍ່ເຊື່ອຟັງ** (ຕັ້ງແຕ່ iOS 10
 * ເປັນຕົ້ນມາ ຫ້າມເວັບປິດການຊູມ) ຈຶ່ງຕ້ອງແກ້ການຊູມເອງຕອນແຕະຊ່ອງປ້ອນ
 * ດ້ວຍຂະໜາດຕົວອັກສອນ 16px ຢູ່ `globals.css` ນຳ — ເບິ່ງ `.field`
 * ໃນ `@media (pointer: coarse)`.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#14171c" },
  ],
};

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
