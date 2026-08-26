import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { DateRangeBar } from "@/components/DateRangeBar";
import { StatTile } from "@/components/StatTile";
import { OrderForm } from "@/components/OrderForm";
import { createOrder, setOrderStatus } from "./actions";
import { formatDateLao, parseDate, resolveRange } from "@/lib/date";
import { formatInt, formatPercent } from "@/lib/format";
import { loadMoney } from "@/lib/money-server";
import { aggregateOrders, orderTotals } from "@/lib/orders";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, options } from "@/lib/labels";
import { OrderStatus } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

type Search = {
  from?: string;
  to?: string;
  preset?: string;
  status?: string;
  campaign?: string;
  q?: string;
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { money } = await loadMoney();
  const sp = await searchParams;
  const range = resolveRange(sp);
  const validStatus = Object.values(OrderStatus).includes(sp.status as OrderStatus)
    ? (sp.status as OrderStatus)
    : undefined;

  const dateWhere = { gte: parseDate(range.from), lte: parseDate(range.to) };
  const where = {
    date: dateWhere,
    ...(validStatus ? { status: validStatus } : {}),
    ...(sp.campaign ? { campaignId: sp.campaign } : {}),
    ...(sp.q
      ? {
          OR: [
            { customerName: { contains: sp.q, mode: "insensitive" as const } },
            { phone: { contains: sp.q } },
            { orderNo: { contains: sp.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [orders, allRangeOrders, campaigns, products, leads] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 300,
      include: {
        campaign: { select: { id: true, name: true } },
        product: { select: { name: true } },
      },
    }),
    prisma.order.findMany({ where: { date: dateWhere } }),
    prisma.campaign.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.lead.findMany({
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 200,
      select: { id: true, name: true, phone: true },
    }),
  ]);

  const totals = aggregateOrders(allRangeOrders);

  return (
    <>
      <PageHeader
        title="Orders ແລະ ຍອດຂາຍຈິງ"
        description="ແຫຼ່ງຄວາມຈິງຂອງຍອດຂາຍ, ຕົ້ນທຶນ, ການສົ່ງສຳເລັດ ແລະຕີກັບ"
      />

      <DateRangeBar
        basePath="/orders"
        range={range}
        activePreset={sp.preset}
        keep={{ status: validStatus, campaign: sp.campaign, q: sp.q }}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile label="Order ທັງໝົດ" value={formatInt(totals.orders)} />
        <StatTile label="ຮັບສຳເລັດ" value={formatInt(totals.delivered)} />
        <StatTile label="ຍອດຂາຍຈິງ" value={money(totals.netRevenue)} hint="ຫຼັງຫັກເງິນຄືນ" />
        <StatTile label="ກຳໄລກ່ອນຄ່າ Ads" value={money(totals.orderMargin)} hint="ຫັກສິນຄ້າ + ຄ່າສົ່ງ + ຄ່າອື່ນ" />
        <StatTile
          label="ອັດຕາຕີກັບ"
          value={formatPercent(totals.returnRate, 1)}
          hint={`${formatInt(totals.returned)} Order ຕີກັບ`}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="grid gap-5">
          <Card>
            <form method="get" action="/orders" className="flex flex-wrap items-end gap-3 p-3">
              <input type="hidden" name="from" value={range.from} />
              <input type="hidden" name="to" value={range.to} />
              <div>
                <label className="label">ຄົ້ນຫາ</label>
                <input name="q" defaultValue={sp.q ?? ""} className="field" placeholder="ຊື່, ເບີ, ເລກ Order" />
              </div>
              <div>
                <label className="label">ສະຖານະ</label>
                <select name="status" defaultValue={validStatus ?? ""} className="field">
                  <option value="">ທັງໝົດ</option>
                  {options(ORDER_STATUS_LABEL).map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">ແຄມເປນ</label>
                <select name="campaign" defaultValue={sp.campaign ?? ""} className="field">
                  <option value="">ທັງໝົດ</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn">ກັ່ນຕອງ</button>
              {validStatus || sp.campaign || sp.q ? (
                <Link href="/orders" className="btn btn-sm">ລ້າງ</Link>
              ) : null}
            </form>
          </Card>

          <Card>
            <CardHeader title="ລາຍການ Order" subtitle={`ສະແດງ ${orders.length} ລາຍການ (ສູງສຸດ 300)`} />
            {orders.length === 0 ? (
              <EmptyState title="ຍັງບໍ່ມີ Order" hint="ເພີ່ມຍອດຂາຍຈິງຈາກຟອມດ້ານຂວາ" />
            ) : (
              <div className="table-wrap max-h-[44rem] overflow-y-auto">
                <table className="data">
                  <thead>
                    <tr>
                      <th>ວັນທີ່ / Order</th>
                      <th>ລູກຄ້າ</th>
                      <th>ສິນຄ້າ / ແຄມເປນ</th>
                      <th className="num">ຍອດຂາຍ</th>
                      <th className="num">ກຳໄລກ່ອນ Ads</th>
                      <th>ສະຖານະ</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => {
                      const one = orderTotals(order);
                      const changeStatus = setOrderStatus.bind(null, order.id);
                      return (
                        <tr key={order.id}>
                          <td className="whitespace-nowrap">
                            <div>{formatDateLao(order.date)}</div>
                            <div className="text-xs text-[var(--fg-subtle)]">{order.orderNo ?? order.id.slice(-8)}</div>
                          </td>
                          <td>
                            <div className="font-medium">{order.customerName}</div>
                            <div className="text-xs text-[var(--fg-subtle)]">{order.phone ?? "—"}</div>
                          </td>
                          <td className="max-w-52 text-xs">
                            <div className="truncate">{order.product?.name ?? "ບໍ່ລະບຸສິນຄ້າ"}</div>
                            <div className="truncate text-[var(--fg-subtle)]">{order.campaign?.name ?? "Organic / ບໍ່ລະບຸ"}</div>
                          </td>
                          <td className="num">{money(order.saleAmount)}</td>
                          <td className={`num ${one.orderMargin >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                            {order.status === "DELIVERED" || order.status === "RETURNED" || order.status === "SHIPPED" ? money(one.orderMargin) : "—"}
                          </td>
                          <td>
                            <form action={changeStatus} className="flex gap-1">
                              <select name="status" defaultValue={order.status} className="field !py-1 !text-xs">
                                {options(ORDER_STATUS_LABEL).map((o) => (
                                  <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                              </select>
                              <button type="submit" className="btn btn-sm">✓</button>
                            </form>
                            <div className="mt-1">
                              <Badge tone={ORDER_STATUS_TONE[order.status]}>{ORDER_STATUS_LABEL[order.status]}</Badge>
                            </div>
                          </td>
                          <td className="num">
                            <Link href={`/orders/${order.id}`} className="btn btn-sm">ແກ້ໄຂ</Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader title="ເພີ່ມ Order" subtitle="ລາຄາ/ຕົ້ນທຶນຈະຖືກ snapshot ໄວ້" />
          {products.length === 0 ? (
            <div className="border-b border-[var(--border)] p-4 text-sm text-[var(--warning)]">
              ຍັງບໍ່ມີ Product — ສາມາດປ້ອນຍອດເອງ ຫຼື <Link href="/products" className="link">ເພີ່ມສິນຄ້າກ່ອນ</Link>
            </div>
          ) : null}
          <OrderForm action={createOrder} campaigns={campaigns} products={products} leads={leads} />
        </Card>
      </div>
    </>
  );
}
