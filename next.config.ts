import type { NextConfig } from "next";

/**
 * ຕອນ `next dev` Next ບລັອກການເອີ້ນ dev asset (hot-reload) ຈາກ host ອື່ນ
 * ນອກຈາກ localhost ເພື່ອຄວາມປອດໄພ.
 *
 * ບໍ່ຝັງ IP/ໂດເມນໄວ້ໃນໂຄດ ເພາະຍ້າຍເຄື່ອງເລື້ອຍ — ໃສ່ໃນ `.env` ຂອງເຄື່ອງນັ້ນ:
 *     ALLOWED_DEV_ORIGINS=119.59.102.23,dev.example.com
 *
 * **ມີຜົນສະເພາະ dev** — ຕອນ production (`next start`) ບໍ່ກ່ຽວຫຍັງເລີຍ.
 */
const allowedDevOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
};

export default nextConfig;
