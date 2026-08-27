import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge, Card, CardHeader, EmptyState, Field, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { createProduct } from "./actions";
import { formatInt, formatPercent, safeDiv } from "@/lib/format";
import { loadMoney } from "@/lib/money-server";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const { money } = await loadMoney();
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { campaigns: true, leads: true } } },
  });

  return (
    <>
      <PageHeader
        title="ສິນຄ້າ / ອອບເຟີ"
        description="ຜູກກັບແຄມເປນ ເພື່ອຄິດກຳໄລ ແລະ ROAS ໄດ້ຖືກຕ້ອງ"
      />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader
            title="ລາຍການສິນຄ້າ"
            subtitle={`ທັງໝົດ ${products.length} ລາຍການ`}
          />
          {products.length === 0 ? (
            <EmptyState title="ຍັງບໍ່ມີສິນຄ້າ" hint="ເພີ່ມສິນຄ້າຢູ່ຟອມທາງຂວາ" />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>ຊື່ສິນຄ້າ</th>
                    <th>ລະຫັດ</th>
                    <th className="num">ລາຄາຂາຍ</th>
                    <th className="num">ຕົ້ນທຶນ</th>
                    <th className="num">ກຳໄລຂັ້ນຕົ້ນ</th>
                    <th className="num">ແຄມເປນ</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const margin = p.price - p.cost;
                    return (
                      <tr key={p.id}>
                        <td className="font-medium">
                          {p.name}{" "}
                          {!p.active ? (
                            <Badge tone="neutral">ປິດໃຊ້</Badge>
                          ) : null}
                        </td>
                        <td className="text-[var(--fg-muted)]">{p.sku ?? "—"}</td>
                        <td className="num">{money(p.price)}</td>
                        <td className="num">{money(p.cost)}</td>
                        <td className="num">
                          {money(margin)}
                          <span className="ml-1 text-xs text-[var(--fg-subtle)]">
                            ({formatPercent(safeDiv(margin, p.price), 0)})
                          </span>
                        </td>
                        <td className="num">{formatInt(p._count.campaigns)}</td>
                        <td className="num">
                          <Link href={`/products/${p.id}`} className="btn btn-sm">
                            ແກ້ໄຂ
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="h-fit">
          <CardHeader title="ເພີ່ມສິນຄ້າໃໝ່" />
          <form action={createProduct} className="grid gap-3 p-3">
            <Field label="ຊື່ສິນຄ້າ *">
              <input name="name" required className="field" />
            </Field>
            <Field label="ລະຫັດ (SKU)">
              <input name="sku" className="field" />
            </Field>
            <Field label="ລາຄາຂາຍ (ກີບ)">
              <input
                name="price"
                type="number"
                min="0"
                step="1000"
                defaultValue={0}
                className="field"
              />
            </Field>
            <Field label="ຕົ້ນທຶນ (ກີບ)">
              <input
                name="cost"
                type="number"
                min="0"
                step="1000"
                defaultValue={0}
                className="field"
              />
            </Field>
            <Field label="ລິ້ງຮູບ">
              <input name="imageUrl" className="field" placeholder="https://..." />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="active"
                defaultChecked
                className="h-4 w-4"
              />
              ໃຊ້ງານຢູ່
            </label>
            <SubmitButton>ເພີ່ມສິນຄ້າ</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
