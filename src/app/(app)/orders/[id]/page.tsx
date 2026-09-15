import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { OrderForm } from "@/components/OrderForm";
import { deleteOrder, updateOrder } from "../actions";
import { formatInt } from "@/lib/format";
import { loadMoney } from "@/lib/money-server";

export const dynamic = "force-dynamic";

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { money } = await loadMoney();
  const [order, campaigns, products, leads] = await Promise.all([
    prisma.order.findUnique({
      where: { id },
      include: { items: true, liveSession: { select: { id: true, title: true } } },
    }),
    prisma.campaign.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.product.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.lead.findMany({
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 200,
      select: { id: true, name: true, phone: true },
    }),
  ]);
  if (!order) notFound();

  const save = updateOrder.bind(null, order.id);
  const remove = deleteOrder.bind(null, order.id);

  return (
    <>
      <PageHeader
        title={`ແກ້ໄຂ Order ${order.orderNo ?? order.id.slice(-8)}`}
        description="ການແກ້ລາຄາ Product ຈະບໍ່ປ່ຽນ snapshot ຂອງ Order ນີ້"
        action={<Link href="/orders" className="btn">← ກັບໄປ Orders</Link>}
      />
      {order.items.length > 0 ? (
        <Card className="mx-auto mb-3 max-w-4xl">
          <CardHeader
            title="ລາຍການສິນຄ້າ"
            subtitle={
              order.liveSession ? (
                <>
                  ບິນຈາກ live{" "}
                  <Link href={`/live/${order.liveSession.id}`} className="link">
                    {order.liveSession.title}
                  </Link>{" "}
                  · ແກ້ລາຍການບໍ່ໄດ້ ຖ້າຍອດປ່ຽນໃຫ້ແກ້ “ຍອດຂາຍ” ຂ້າງລຸ່ມ
                </>
              ) : undefined
            }
          />
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>ລະຫັດ</th>
                  <th>ສິນຄ້າ</th>
                  <th className="num">ຈຳນວນ</th>
                  <th className="num">ລາຄາ</th>
                  <th className="num">ລວມ</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.code ?? "—"}</td>
                    <td>{item.name}</td>
                    <td className="num">{formatInt(item.quantity)}</td>
                    <td className="num">{money(item.unitPrice)}</td>
                    <td className="num">{money(item.unitPrice * item.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <Card className="mx-auto max-w-4xl">
        <CardHeader title="ຂໍ້ມູນ Order" />
        <OrderForm
          action={save}
          campaigns={campaigns}
          products={products}
          leads={leads}
          value={order}
          submitLabel="ບັນທຶກການແກ້ໄຂ"
        />
        <div className="border-t border-[var(--border)] p-4">
          <form action={remove}>
            <button type="submit" className="btn text-[var(--danger)]">ລຶບ Order ນີ້</button>
          </form>
        </div>
      </Card>
    </>
  );
}
