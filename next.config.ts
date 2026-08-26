import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * ຕອນ `next dev` Next ຈະບລັອກການເອີ້ນ dev asset (ເຊັ່ນ hot-reload)
   * ຈາກ host ອື່ນນອກຈາກ localhost ເພື່ອຄວາມປອດໄພ.
   *
   * ໃສ່ host ພາຍໃນໄວ້ ເພື່ອໃຫ້ທົດສອບຈາກເຄື່ອງອື່ນໃນອົງກອນໄດ້.
   * **ມີຜົນສະເພາະ dev** — ຕອນ production (`next start`) ບໍ່ກ່ຽວຫຍັງເລີຍ.
   */
  allowedDevOrigins: [
    "10.0.40.77",
    "mounoyfb.odienmall.com",
    // ເຄື່ອງອື່ນໃນເຄືອຂ່າຍດຽວກັນ
    "10.0.40.*",
  ],
};

export default nextConfig;
