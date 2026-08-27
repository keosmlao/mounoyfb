import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth-server";
import { resolveRange, toDateInput } from "@/lib/date";
import { csvHeaders, toCsv } from "@/lib/csv";
import { leadWhere } from "@/lib/list-filters";
import { LEAD_STATUS_LABEL } from "@/lib/labels";

/** ສົ່ງອອກລູກຄ້າເປັນ CSV ຕາມຕົວກັ່ນຕອງດຽວກັບໜ້າຈໍ */
export const dynamic = "force-dynamic";

const COLUMNS = [
  "ວັນທີ່",
  "ຊື່",
  "ເບີໂທ",
  "ຊື່ໃນ Facebook",
  "ຊ່ອງທາງ",
  "ສະຖານະ",
  "ຍອດຊື້(ກີບ)",
  "ແຄມເປນ",
  "ສິນຄ້າ",
  "ຜູ້ຮັບຜິດຊອບ",
  "ໝາຍເຫດ",
];

export async function GET(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const p = new URL(request.url).searchParams;
  const range = resolveRange({
    from: p.get("from") ?? undefined,
    to: p.get("to") ?? undefined,
    preset: p.get("preset") ?? undefined,
  });

  const leads = await prisma.lead.findMany({
    where: leadWhere(range, {
      status: p.get("status") ?? undefined,
      campaign: p.get("campaign") ?? undefined,
      q: p.get("q") ?? undefined,
    }),
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: {
      campaign: { select: { name: true } },
      product: { select: { name: true } },
    },
  });

  const body = toCsv(
    COLUMNS,
    leads.map((l) => [
      toDateInput(l.date),
      l.name,
      l.phone ?? "",
      l.fbName ?? "",
      l.channel ?? "",
      LEAD_STATUS_LABEL[l.status],
      Math.round(l.amount),
      l.campaign?.name ?? "",
      l.product?.name ?? "",
      l.assignee ?? "",
      l.note ?? "",
    ]),
  );

  return new NextResponse(body, {
    headers: csvHeaders(`fbmonoy-leads-${range.from}-${range.to}.csv`),
  });
}
