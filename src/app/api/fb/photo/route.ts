import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth-server";
import { photoSource } from "@/lib/fb-photos";
import { proxyImage } from "@/lib/image-proxy";

/**
 * ຮູບຫຍໍ້ຂອງຮູບໃນເພຈ ຕອນເລືອກມາສ້າງສິນຄ້າ — `?page=<FbPage.id>&photo=<id>`.
 * ລິ້ງ Facebook ໝົດອາຍຸ ແລະ ຕ້ອງໃຊ້ page token ຈຶ່ງບໍ່ໃສ່ `<img>` ໂດຍກົງ.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const params = new URL(request.url).searchParams;
  const pageId = params.get("page");
  const photoId = params.get("photo");
  if (!pageId || !photoId || !/^\d+$/.test(photoId)) {
    return new NextResponse("ຕ້ອງບອກ page ແລະ photo", { status: 400 });
  }

  try {
    const url = await photoSource(pageId, photoId);
    if (!url) return new NextResponse("ບໍ່ພົບຮູບ", { status: 404 });
    return proxyImage(url, () => photoSource(pageId, photoId, true));
  } catch {
    return new NextResponse("ດຶງຮູບບໍ່ໄດ້", { status: 502 });
  }
}
