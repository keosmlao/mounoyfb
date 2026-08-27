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

  // ກວດສະພາບລະບົບ — ເຄື່ອງມືເຝົ້າເບິ່ງບໍ່ມີ cookie ຈຶ່ງຕ້ອງເຂົ້າໄດ້ໂດຍບໍ່ login
  // (route ນັ້ນບໍ່ສົ່ງຂໍ້ມູນທຸລະກິດອອກ ບອກແຕ່ວ່າຕໍ່ຖານຂໍ້ມູນໄດ້ບໍ່)
  if (pathname === "/api/health") return NextResponse.next();

  // Webhook ຂອງ Facebook — ເຂົາບໍ່ມີ cookie ຂອງເຮົາ ຈຶ່ງ login ບໍ່ໄດ້.
  // ດ່ານກັນຂອງມັນຄືລາຍເຊັນ `X-Hub-Signature-256` ທີ່ກວດຢູ່ໃນ route ເອງ
  // (ເບິ່ງ `src/app/api/fb/webhook/route.ts`)
  if (pathname === "/api/fb/webhook") return NextResponse.next();

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
