import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth-server";
import { resolveRange, toDateInput } from "@/lib/date";
import { csvHeaders, toCsv } from "@/lib/csv";
import { orderWhere } from "@/lib/list-filters";
import { orderTotals } from "@/lib/orders";
import { ORDER_STATUS_LABEL } from "@/lib/labels";

/**
 * ສົ່ງອອກ Order ເປັນ CSV ຕາມຕົວກັ່ນຕອງດຽວກັບໜ້າຈໍ.
 *
 * ບໍ່ຈຳກັດ 100 ແຖວຄືໜ້າຈໍ — ຄົນທີ່ກົດ “ສົ່ງອອກ” ຕ້ອງການທັງຊ່ວງ
 * ໄປເຮັດຕໍ່ໃນ Excel ບໍ່ແມ່ນຕ້ອງການສະເພາະໜ້າທຳອິດ.
 */
export const dynamic = "force-dynamic";

const COLUMNS = [
  "ວັນທີ່",
  "ເລກ Order",
  "ລູກຄ້າ",
  "ເບີໂທ",
  "ຊ່ອງທາງ",
  "ສິນຄ້າ",
  "ຈຳນວນ",
  "ແຄມເປນ",
  "ສະຖານະ",
  "ຍອດຂາຍ(ກີບ)",
  "ຕົ້ນທຶນສິນຄ້າ(ກີບ)",
  "ຄ່າສົ່ງ(ກີບ)",
  "ຄ່າອື່ນ(ກີບ)",
  "ເງິນຄືນ(ກີບ)",
  "ກຳໄລກ່ອນຄ່າAds(ກີບ)",
  "ເລກຕິດຕາມ",
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

  const orders = await prisma.order.findMany({
    where: orderWhere(range, {
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
    orders.map((o) => [
      toDateInput(o.date),
      o.orderNo ?? "",
      o.customerName,
      o.phone ?? "",
      o.channel ?? "",
      o.product?.name ?? "",
      o.quantity,
      o.campaign?.name ?? "",
      ORDER_STATUS_LABEL[o.status],
      Math.round(o.saleAmount),
      Math.round(o.productCost),
      Math.round(o.shippingCost),
      Math.round(o.otherCost),
      Math.round(o.refundAmount),
      Math.round(orderTotals(o).orderMargin),
      o.trackingNo ?? "",
      o.note ?? "",
    ]),
  );

  return new NextResponse(body, {
    headers: csvHeaders(`fbmonoy-orders-${range.from}-${range.to}.csv`),
  });
}
