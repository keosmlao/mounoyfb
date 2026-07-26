import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardHeader, Field, PageHeader } from "@/components/ui";
import { DeleteButton, SubmitButton } from "@/components/SubmitButton";
import { deleteFbPage, updateFbPage } from "../actions";
import { STATUS_LABEL, options } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function EditFbPagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const page = await prisma.fbPage.findUnique({
    where: { id },
    include: { _count: { select: { campaigns: true } } },
  });
  if (!page) notFound();

  const update = updateFbPage.bind(null, id);
  const remove = deleteFbPage.bind(null, id);

  return (
    <>
      <PageHeader
        title={page.name}
        description="ແກ້ໄຂຂໍ້ມູນເພຈ"
        action={
          <Link href="/fb-pages" className="btn">
            ← ກັບຄືນ
          </Link>
        }
      />

      <div className="grid max-w-2xl gap-5">
        <Card>
          <CardHeader title="ຂໍ້ມູນເພຈ" />
          <form action={update} className="grid gap-4 p-4 sm:grid-cols-2">
            <Field label="ຊື່ເພຈ *" className="sm:col-span-2">
              <input name="name" required defaultValue={page.name} className="field" />
            </Field>
            <Field label="Facebook Page ID">
              <input
                name="fbPageId"
                defaultValue={page.fbPageId ?? ""}
                className="field"
              />
            </Field>
            <Field label="ໝວດໝູ່">
              <input
                name="category"
                defaultValue={page.category ?? ""}
                className="field"
              />
            </Field>
            <Field label="ສະຖານະ">
              <select name="status" defaultValue={page.status} className="field">
                {options(STATUS_LABEL).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="ໝາຍເຫດ" className="sm:col-span-2">
              <textarea
                name="note"
                rows={2}
                defaultValue={page.note ?? ""}
                className="field"
              />
            </Field>
            <div className="sm:col-span-2">
              <SubmitButton>ບັນທຶກການແກ້ໄຂ</SubmitButton>
            </div>
          </form>
        </Card>

        <Card>
          <CardHeader
            title="ລຶບເພຈນີ້"
            subtitle={`ມີ ${page._count.campaigns} ແຄມເປນທີ່ອ້າງເຖິງ — ແຄມເປນຈະບໍ່ຖືກລຶບ ພຽງແຕ່ຕັດການເຊື່ອມ`}
          />
          <form action={remove} className="p-4">
            <DeleteButton
              label="ລຶບເພຈ"
              confirmText={`ລຶບເພຈ "${page.name}"?`}
            />
          </form>
        </Card>
      </div>
    </>
  );
}
