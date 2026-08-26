import type { NextConfig } from "next";

/**
 * ຕອນ `next dev` Next ບລັອກການເອີ້ນ dev asset (hot-reload) ຈາກ host ອື່ນ
 * ນອກຈາກ localhost ເພື່ອຄວາມປອດໄພ. ໃສ່ host ທີ່ໃຊ້ທົດສອບໄວ້ບ່ອນນີ້.
 *
 * ເພີ່ມເຄື່ອງໃໝ່ໂດຍບໍ່ຕ້ອງແກ້ໂຄດ — ໃສ່ໃນ `.env` ຂອງເຄື່ອງນັ້ນ:
 *     ALLOWED_DEV_ORIGINS=203.0.113.5,dev.example.com
 *
 * **ມີຜົນສະເພາະ dev** — ຕອນ production (`next start`) ບໍ່ກ່ຽວຫຍັງເລີຍ.
 */
const extraOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "10.0.40.77",
    "10.0.40.*",
    "mounoyfb.odienmall.com",
    ...extraOrigins,
  ],
};

export default nextConfig;
