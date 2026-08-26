import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { OrderForm } from "@/components/OrderForm";
import { deleteOrder, updateOrder } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [order, campaigns, products, leads] = await Promise.all([
    prisma.order.findUnique({ where: { id } }),
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
