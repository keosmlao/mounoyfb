import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardHeader, Field, PageHeader } from "@/components/ui";
import { DeleteButton, SubmitButton } from "@/components/SubmitButton";
import { deleteProduct, updateProduct } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: { _count: { select: { campaigns: true, leads: true } } },
  });
  if (!product) notFound();

  const update = updateProduct.bind(null, id);
  const remove = deleteProduct.bind(null, id);

  return (
    <>
      <PageHeader
        title={product.name}
        description="ແກ້ໄຂຂໍ້ມູນສິນຄ້າ"
        action={
          <Link href="/products" className="btn">
            ← ກັບຄືນ
          </Link>
        }
      />

      <div className="grid max-w-2xl gap-5">
        <Card>
          <CardHeader title="ຂໍ້ມູນສິນຄ້າ" />
          <form action={update} className="grid gap-4 p-4 sm:grid-cols-2">
            <Field label="ຊື່ສິນຄ້າ *" className="sm:col-span-2">
              <input
                name="name"
                required
                defaultValue={product.name}
                className="field"
              />
            </Field>
            <Field label="ລະຫັດ (SKU)">
              <input name="sku" defaultValue={product.sku ?? ""} className="field" />
            </Field>
            <Field label="ລິ້ງຮູບ">
              <input
                name="imageUrl"
                defaultValue={product.imageUrl ?? ""}
                className="field"
              />
            </Field>
            <Field label="ລາຄາຂາຍ (ກີບ)">
              <input
                name="price"
                type="number"
                min="0"
                step="1000"
                defaultValue={product.price}
                className="field"
              />
            </Field>
            <Field label="ຕົ້ນທຶນ (ກີບ)">
              <input
                name="cost"
                type="number"
                min="0"
                step="1000"
                defaultValue={product.cost}
                className="field"
              />
            </Field>
            <Field label="ໝາຍເຫດ" className="sm:col-span-2">
              <textarea
                name="note"
                rows={2}
                defaultValue={product.note ?? ""}
                className="field"
              />
            </Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                name="active"
                defaultChecked={product.active}
                className="h-4 w-4"
              />
              ໃຊ້ງານຢູ່
            </label>
            <div className="sm:col-span-2">
              <SubmitButton>ບັນທຶກການແກ້ໄຂ</SubmitButton>
            </div>
          </form>
        </Card>

        <Card>
          <CardHeader
            title="ລຶບສິນຄ້ານີ້"
            subtitle={`ຜູກກັບ ${product._count.campaigns} ແຄມເປນ ແລະ ${product._count.leads} ລູກຄ້າ — ຈະຖືກຕັດການເຊື່ອມ ບໍ່ຖືກລຶບ`}
          />
          <form action={remove} className="p-4">
            <DeleteButton
              label="ລຶບສິນຄ້າ"
              confirmText={`ລຶບ "${product.name}"?`}
            />
          </form>
        </Card>
      </div>
    </>
  );
}
