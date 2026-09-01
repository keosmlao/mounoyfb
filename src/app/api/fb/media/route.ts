import { NextResponse } from "next/server";
import { commentMedia, messageMedia, type MediaSource } from "@/lib/fb-inbox";

/**
 * ສົ່ງຕໍ່ໄຟລ໌ແນບຂອງກ່ອງຂໍ້ຄວາມ (ຮູບ / ວິດີໂອ / ສຽງ / ໄຟລ໌).
 *
 * ເປັນຫຍັງບໍ່ໃສ່ລິ້ງຂອງ Facebook ໃສ່ `<img>` ໂດຍກົງ:
 * - ລິ້ງ `lookaside.fbsbx.com` **ໝົດອາຍຸ** — ຮູບເກົ່າຈະກາຍເປັນຮູບແຕກ
 *   ບ່ອນນີ້ຂໍລິ້ງໃໝ່ໃຫ້ອັດຕະໂນມັດເມື່ອດຶງບໍ່ໄດ້
 * - ບາງໄຟລ໌ຕ້ອງມີ *page token* ຈຶ່ງເປີດໄດ້ ຊຶ່ງ **ຫ້າມສົ່ງອອກໜ້າຈໍ**
 * - ບໍ່ຕ້ອງໃຫ້ browser ຂອງຜູ້ໃຊ້ໄປແຕະ Facebook ໂດຍກົງ
 *
 * ດ່ານ login ຢູ່ `src/proxy.ts` ຄຸມ route ນີ້ຢູ່ແລ້ວ (ຍົກເວັ້ນແຕ່ webhook/health).
 */
export const dynamic = "force-dynamic";

/** ຊະນິດທີ່ປອດໄພໃຫ້ browser ເປີດໃນໜ້າ — ນອກນັ້ນບັງຄັບໃຫ້ໂຫຼດລົງເຄື່ອງ */
const INLINE_TYPES = [
  /^image\/(jpeg|pjpeg|png|gif|webp|avif|heic|heif|bmp)$/,
  /^video\//,
  /^audio\//,
  /^application\/pdf$/,
];

/**
 * ເລືອກ Content-Type ທີ່ຈະຕອບ.
 *
 * ບໍ່ສົ່ງຄ່າດິບຂອງ Facebook ຜ່ານໄປຊື່ໆ — ໄຟລ໌ມາຈາກຄົນນອກ ຖ້າມັນເປັນ
 * html/svg ແລ້ວເປີດໃນໂດເມນເຮົາ ມັນຈະແລ່ນສະຄຣິບໃນນາມຂອງຜູ້ໃຊ້ທີ່ login ຢູ່.
 */
function safeType(upstream: string | null, fallback: string | null) {
  const raw = (upstream ?? fallback ?? "").split(";")[0].trim().toLowerCase();
  return INLINE_TYPES.some((ok) => ok.test(raw))
    ? { type: raw, inline: true }
    : { type: "application/octet-stream", inline: false };
}

/** ຊື່ໄຟລ໌ໃນ header — ຕັດຕົວທີ່ພັງ header ອອກ ແລ້ວເຂົ້າລະຫັດພາສາລາວໄວ້ */
function disposition(inline: boolean, name: string | null) {
  const kind = inline ? "inline" : "attachment";
  if (!name) return kind;
  const safe = name.replace(/[^\w.\-() ]+/g, "_").slice(0, 80) || "file";
  return `${kind}; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

function pull(source: MediaSource, range: string | null) {
  return fetch(source.url, {
    cache: "no-store",
    headers: range ? { range } : undefined,
    // ບໍ່ໃຫ້ຄ້າງລໍ Facebook ຈົນ request ຂອງຜູ້ໃຊ້ຄ້າງນຳ
    signal: AbortSignal.timeout(20_000),
  });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const messageId = params.get("msg");
  const commentId = params.get("comment");
  const index = Math.max(0, Math.trunc(Number(params.get("i")) || 0));

  if (!messageId && !commentId) {
    return new NextResponse("ຕ້ອງບອກ msg ຫຼື comment", { status: 400 });
  }

  const find = (refresh: boolean) =>
    messageId ? messageMedia(messageId, index, refresh) : commentMedia(commentId!, refresh);

  // ຜູ້ຟັງສຽງ/ເບິ່ງວິດີໂອ ຂໍເປັນຊ່ວງໄບຕ໌ (Safari ບັງຄັບ) — ສົ່ງຕໍ່ໃຫ້ຄືເກົ່າ
  const range = request.headers.get("range");

  try {
    let source = await find(false);
    if (!source) return new NextResponse("ບໍ່ພົບໄຟລ໌ແນບ", { status: 404 });

    let upstream = await pull(source, range);
    if (!upstream.ok) {
      // ລິ້ງໝົດອາຍຸແມ່ນເລື່ອງປົກກະຕິ — ຂໍໃໝ່ຈາກ Facebook ແລ້ວລອງອີກເທື່ອດຽວ
      const fresh = await find(true);
      if (fresh && fresh.url !== source.url) {
        source = fresh;
        upstream = await pull(source, range);
      }
    }
    if (!upstream.ok || !upstream.body) {
      return new NextResponse("Facebook ບໍ່ໃຫ້ໄຟລ໌ນີ້ແລ້ວ", { status: 502 });
    }

    const { type, inline } = safeType(
      upstream.headers.get("content-type"),
      source.mime,
    );
    const headers = new Headers({
      "Content-Type": type,
      "Content-Disposition": disposition(inline, source.name),
      // ຊື່ຄົນ/ຮູບລູກຄ້າ — ຫ້າມໃຫ້ proxy ກາງທາງເກັບ
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    });
    for (const key of ["content-length", "content-range", "accept-ranges"]) {
      const value = upstream.headers.get(key);
      if (value) headers.set(key, value);
    }

    return new NextResponse(upstream.body, { status: upstream.status, headers });
  } catch {
    // ຮ້ອງ Facebook ບໍ່ໄດ້ / ໝົດເວລາ — ບອກສັ້ນໆ ບໍ່ຕ້ອງເປີດເຜີຍລາຍລະອຽດ
    return new NextResponse("ດຶງໄຟລ໌ແນບບໍ່ໄດ້", { status: 502 });
  }
}
