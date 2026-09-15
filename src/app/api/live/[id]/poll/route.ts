import { NextResponse, type NextRequest } from "next/server";
import { isAuthenticated } from "@/lib/auth-server";
import { pullLiveComments } from "@/lib/live-server";

/**
 * ໜ້າ live ທີ່ເປີດຢູ່ຮ້ອງທຸກ 4 ວິນາທີ ເພື່ອດຶງ CF ໃໝ່.
 *
 * ເປັນ route handler ບໍ່ແມ່ນ server action — action ຂອງໜ້າດຽວກັນແລ່ນຕໍ່ຄິວກັນ
 * ການດຶງຖີ່ໆຈະເຮັດໃຫ້ປຸ່ມ "ຍົກເລີກ" ຂອງຄົນຂາຍຄ້າງລໍ.
 * ການກັນດຶງຊ້ອນ (ຫຼາຍແທັບ/ຫຼາຍຄົນ) ຢູ່ `pullLiveComments()` ເອງ.
 */
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, ctx: RouteContext<"/api/live/[id]/poll">) {
  // proxy ກວດໄດ້ແຕ່ລາຍເຊັນ — ບັນຊີທີ່ຖືກປິດແລ້ວຕ້ອງກວດຢູ່ບ່ອນນີ້
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const result = await pullLiveComments(id);
  return NextResponse.json(result);
}
