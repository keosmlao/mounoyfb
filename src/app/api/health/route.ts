import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * ກວດວ່າລະບົບຍັງດີຢູ່ບໍ່ — ໃຊ້ໂດຍ nginx / systemd / ຄົນທີ່ເຝົ້າເບິ່ງເຊີບເວີ.
 *
 * **ບໍ່ຕ້ອງ login** (ຍົກເວັ້ນໄວ້ໃນ `src/proxy.ts`) ເພາະເຄື່ອງມືເຝົ້າເບິ່ງ
 * ບໍ່ມີ cookie — ຈຶ່ງ **ຫ້າມສົ່ງຂໍ້ມູນທຸລະກິດອອກໄປ**. ສິ່ງທີ່ບອກໄດ້ມີແຕ່
 * "ຕໍ່ຖານຂໍ້ມູນໄດ້ບໍ່" ແລະ "ຂໍ້ມູນສົດປານໃດ" ຊຶ່ງເປັນເລື່ອງການເດີນເຄື່ອງ
 * ບໍ່ໄດ້ບອກຊື່ແຄມເປນ, ຍອດເງິນ ຫຼື ຈຳນວນລູກຄ້າຈັກຢ່າງ.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;

    // ຂໍ້ມູນຄ້າງກໍ່ຄືລະບົບເສຍຢ່າງໜຶ່ງ — ແຕ່ຄົນລະຢ່າງກັບຖານຂໍ້ມູນລົ້ມ
    // ຈຶ່ງບອກໄວ້ໃຫ້ເຄື່ອງເຝົ້າເບິ່ງເຕືອນໄດ້ ໂດຍບໍ່ໄດ້ຕອບ 503
    const [lastSync, lastSuccess] = await Promise.all([
      prisma.syncLog.findFirst({
        orderBy: { startedAt: "desc" },
        select: { status: true },
      }),
      prisma.syncLog.findFirst({
        where: { status: "SUCCESS" },
        orderBy: { startedAt: "desc" },
        select: { startedAt: true, finishedAt: true },
      }),
    ]);

    const successAt = lastSuccess?.finishedAt ?? lastSuccess?.startedAt ?? null;

    return NextResponse.json(
      {
        status: "ok",
        database: "up",
        ms: Date.now() - startedAt,
        lastSyncStatus: lastSync?.status ?? null,
        lastSyncAgeMinutes: successAt
          ? Math.floor((Date.now() - successAt.getTime()) / 60_000)
          : null,
      },
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
