import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

/**
 * ດ່ານກວດ login ຂອງທັງລະບົບ (Next.js 16 ປ່ຽນຊື່ຈາກ middleware → proxy).
 *
 * ທຸກ request ທີ່ບໍ່ມີ cookie ທີ່ຖືກຕ້ອງຈະຖືກສົ່ງໄປໜ້າ /login
 * ລວມທັງ route handler (`/api/...`) ແລະ server action ນຳ.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isLoginPage = pathname === "/login";

  const authenticated = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value,
  );

  if (authenticated) {
    // login ແລ້ວແຕ່ຍັງຢູ່ໜ້າ login — ພາກັບໜ້າຫຼັກ
    if (isLoginPage) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (isLoginPage) return NextResponse.next();

  const url = new URL("/login", request.url);
  // ຈື່ໜ້າທີ່ຢາກໄປໄວ້ ເພື່ອພາກັບໄປຫຼັງ login ສຳເລັດ
  if (pathname !== "/") url.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(url);
}

export const config = {
  /**
   * ຂ້າມສະເພາະໄຟລ໌ static ຂອງ Next ແລະ favicon —
   * ນອກນັ້ນກວດໝົດ ລວມທັງ /api
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
