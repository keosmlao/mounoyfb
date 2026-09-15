import { NextResponse } from "next/server";

/**
 * ສົ່ງຕໍ່ຮູບຈາກ Facebook ຜ່ານເຊີບເວີເຮົາ.
 * ຮັບສະເພາະຊະນິດຮູບທີ່ປອດໄພ — ອັນອື່ນ (html/svg) ຖ້າເປີດໃນໂດເມນເຮົາຈະແລ່ນສະຄຣິບໄດ້.
 */
const IMAGE_TYPES = /^image\/(jpeg|pjpeg|png|gif|webp|avif|heic|heif)$/;

function pull(url: string) {
  return fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
}

export async function proxyImage(
  url: string,
  refresh?: () => Promise<string | null>,
): Promise<NextResponse> {
  try {
    let upstream = await pull(url);
    if (!upstream.ok && refresh) {
      // ລິ້ງໝົດອາຍຸແມ່ນເລື່ອງປົກກະຕິ — ຂໍໃໝ່ແລ້ວລອງອີກເທື່ອດຽວ
      const fresh = await refresh();
      if (fresh && fresh !== url) upstream = await pull(fresh);
    }
    if (!upstream.ok || !upstream.body) {
      return new NextResponse("Facebook ບໍ່ໃຫ້ຮູບນີ້ແລ້ວ", { status: 502 });
    }

    const type = (upstream.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!IMAGE_TYPES.test(type)) {
      return new NextResponse("ບໍ່ແມ່ນໄຟລ໌ຮູບ", { status: 415 });
    }

    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new NextResponse("ດຶງຮູບບໍ່ໄດ້", { status: 502 });
  }
}
