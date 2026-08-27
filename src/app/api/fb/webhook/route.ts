import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncInboxFromWebhook } from "@/lib/auto-sync";

/**
 * Webhook ຂອງ Facebook — ໃຫ້ comment ແລະ ແຊັດເຂົ້າມາ**ທັນທີ**
 * ບໍ່ຕ້ອງລໍຮອບດຶງຕາມເວລາ (ຊຶ່ງຊ້າສຸດ 5-15 ນາທີ).
 *
 * **ບໍ່ຕ້ອງ login** — Facebook ບໍ່ມີ cookie ຂອງເຮົາ. ດ່ານກັນຄື
 * **ລາຍເຊັນ `X-Hub-Signature-256`** ທີ່ຄິດຈາກ app secret ຊຶ່ງມີແຕ່
 * Facebook ກັບເຮົາຮູ້ — ຕ້ອງຍົກເວັ້ນ route ນີ້ໄວ້ໃນ `src/proxy.ts` ນຳ.
 *
 * ຫຼັກການສຳຄັນ: **ບໍ່ເຊື່ອຂໍ້ມູນໃນ payload** ໄປຂຽນລົງຖານຂໍ້ມູນ —
 * ໃຊ້ມັນເປັນແຕ່ສັນຍານວ່າ "ມີຫຍັງປ່ຽນ" ແລ້ວໃຫ້ `syncInbox()` ດຶງເອງ.
 * ບໍ່ດັ່ງນັ້ນຈະມີສອງເສັ້ນທາງຂຽນທີ່ຄ່ອຍໆເພື້ອນຈາກກັນ.
 */
export const dynamic = "force-dynamic";

export const WEBHOOK_KEYS = {
  appSecret: "fbAppSecret",
  verifyToken: "fbWebhookVerifyToken",
} as const;

async function setting(key: string): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value?.trim() || null;
}

/**
 * ຂັ້ນຕອນຢືນຢັນຕອນຕັ້ງຄ່າຄັ້ງທຳອິດ — Facebook ຮ້ອງມາພ້ອມຄຳທ້າທາຍ
 * ແລ້ວລໍໃຫ້ເຮົາສົ່ງຄືນຄືເກົ່າ ຖ້າ verify token ກົງກັນ.
 */
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const expected = await setting(WEBHOOK_KEYS.verifyToken);

  if (
    expected &&
    p.get("hub.mode") === "subscribe" &&
    p.get("hub.verify_token") === expected
  ) {
    return new NextResponse(p.get("hub.challenge") ?? "", {
      headers: { "Content-Type": "text/plain" },
    });
  }
  return new NextResponse("forbidden", { status: 403 });
}

/** ລາຍເຊັນຖືກຕ້ອງບໍ່ — ປຽບທຽບແບບໃຊ້ເວລາຄົງທີ່ ກັນການເດົາທີລະໄບຕ໌ */
function signatureOk(raw: string, header: string | null, secret: string) {
  if (!header?.startsWith("sha256=")) return false;

  const mine = createHmac("sha256", secret).update(raw, "utf8").digest();
  const theirs = Buffer.from(header.slice(7), "hex");
  return mine.length === theirs.length && timingSafeEqual(mine, theirs);
}

type WebhookBody = {
  object?: string;
  entry?: {
    changes?: { field?: string; value?: { item?: string } }[];
    messaging?: unknown[];
  }[];
};

/** ເຫດການນີ້ກ່ຽວກັບກ່ອງຂໍ້ຄວາມບໍ່ — ອັນອື່ນ (ໄລຄ໌ເພຈ, ແກ້ໂພສ) ບໍ່ຕ້ອງດຶງ */
function touchesInbox(body: WebhookBody): boolean {
  if (body.object !== "page") return false;

  return (body.entry ?? []).some(
    (entry) =>
      (entry.messaging?.length ?? 0) > 0 ||
      (entry.changes ?? []).some(
        (c) => c.field === "feed" && c.value?.item === "comment",
      ),
  );
}

export async function POST(request: Request) {
  // ຕ້ອງອ່ານເປັນຂໍ້ຄວາມດິບກ່ອນ — ລາຍເຊັນຄິດຈາກໄບຕ໌ຕົ້ນສະບັບ
  // ຖ້າ parse ເປັນ JSON ແລ້ວ stringify ຄືນ ຊ່ອງຫວ່າງຈະປ່ຽນ ແລ້ວລາຍເຊັນຈະບໍ່ກົງ
  const raw = await request.text();

  const secret = await setting(WEBHOOK_KEYS.appSecret);
  if (!secret) {
    // ຍັງບໍ່ໄດ້ຕັ້ງ app secret = ຢືນຢັນບໍ່ໄດ້ = ບໍ່ຮັບ
    return new NextResponse("not configured", { status: 403 });
  }

  if (!signatureOk(raw, request.headers.get("x-hub-signature-256"), secret)) {
    return new NextResponse("bad signature", { status: 401 });
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(raw) as WebhookBody;
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }

  // Facebook ຖືວ່າຊ້າກວ່າ 20 ວິນາທີແມ່ນລົ້ມ ແລ້ວຈະສົ່ງຊ້ຳ —
  // ຈຶ່ງຕອບ 200 ທັນທີ ແລ້ວຄ່ອຍດຶງເບື້ອງຫຼັງ
  if (touchesInbox(body)) {
    after(async () => {
      try {
        await syncInboxFromWebhook();
      } catch (error) {
        console.error("[fb-webhook]", error);
      }
    });
  }

  return new NextResponse("ok");
}
