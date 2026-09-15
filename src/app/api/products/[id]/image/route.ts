import { NextResponse, type NextRequest } from "next/server";
import { isAuthenticated } from "@/lib/auth-server";
import { productImageTarget } from "@/lib/fb-photos";
import { proxyImage } from "@/lib/image-proxy";

/** ຮູບຂອງສິນຄ້າ — ຮູບຈາກເພຈຂໍລິ້ງໃໝ່ໃຫ້ເອງເມື່ອໝົດອາຍຸ (ເບິ່ງ `fb-photos.ts`) */
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/products/[id]/image">) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  try {
    const target = await productImageTarget(id);
    if (!target) return new NextResponse("ສິນຄ້ານີ້ບໍ່ມີຮູບ", { status: 404 });
    if (target.kind === "redirect") return NextResponse.redirect(target.url);
    return proxyImage(target.url, target.refresh);
  } catch {
    return new NextResponse("ດຶງຮູບບໍ່ໄດ້", { status: 502 });
  }
}
