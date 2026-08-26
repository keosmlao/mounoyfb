import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * ກວດວ່າລະບົບຍັງດີຢູ່ບໍ່ — ໃຊ້ໂດຍ nginx / systemd / ຄົນທີ່ເຝົ້າເບິ່ງເຊີບເວີ.
 *
 * **ບໍ່ຕ້ອງ login** (ຍົກເວັ້ນໄວ້ໃນ `src/proxy.ts`) ເພາະເຄື່ອງມືເຝົ້າເບິ່ງ
 * ບໍ່ມີ cookie — ຈຶ່ງ **ຫ້າມສົ່ງຂໍ້ມູນທຸລະກິດອອກໄປ** ບອກແຕ່ວ່າຕໍ່ຖານຂໍ້ມູນໄດ້ບໍ່.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: "ok", database: "up", ms: Date.now() - startedAt },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    // ຢ່າສົ່ງລາຍລະອຽດ error ອອກ — ມັນມັກມີ host/user ຂອງຖານຂໍ້ມູນຕິດໄປນຳ
    return NextResponse.json(
      { status: "error", database: "down", ms: Date.now() - startedAt },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
