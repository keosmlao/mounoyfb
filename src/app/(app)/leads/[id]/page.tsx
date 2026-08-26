import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardHeader, Field, PageHeader } from "@/components/ui";
import { DeleteButton, SubmitButton } from "@/components/SubmitButton";
import { deleteLead, updateLead } from "../actions";
import { toDateInput } from "@/lib/date";
import { LEAD_CHANNELS, LEAD_STATUS_LABEL, options } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function EditLeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [lead, campaigns, products] = await Promise.all([
    prisma.lead.findUnique({ where: { id } }),
    prisma.campaign.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!lead) notFound();

  const update = updateLead.bind(null, id);
  const remove = deleteLead.bind(null, id);

  return (
    <>
      <PageHeader
        title={lead.name}
        description="ແກ້ໄຂຂໍ້ມູນລູກຄ້າ"
        action={
          <Link href="/leads" className="btn">
            ← ກັບຄືນ
          </Link>
        }
      />

      <div className="grid max-w-3xl gap-5">
        <Card>
          <CardHeader title="ຂໍ້ມູນລູກຄ້າ" />
          <form action={update} className="grid gap-4 p-4 sm:grid-cols-2">
            <Field label="ວັນທີ່ *">
              <input
                name="date"
                type="date"
                required
                defaultValue={toDateInput(lead.date)}
                className="field"
              />
            </Field>
            <Field label="ຊື່ລູກຄ້າ *">
              <input name="name" required defaultValue={lead.name} className="field" />
            </Field>
            <Field label="ເບີໂທ">
              <input name="phone" defaultValue={lead.phone ?? ""} className="field" />
            </Field>
            <Field label="ຊື່ໃນ Facebook">
              <input name="fbName" defaultValue={lead.fbName ?? ""} className="field" />
            </Field>
            <Field label="ຊ່ອງທາງ">
              <select
                name="channel"
                defaultValue={lead.channel ?? "Messenger"}
                className="field"
              >
                {LEAD_CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="ສະຖານະ">
              <select name="status" defaultValue={lead.status} className="field">
                {options(LEAD_STATUS_LABEL).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="ແຄມເປນທີ່ມາ">
              <select
                name="campaignId"
                defaultValue={lead.campaignId ?? ""}
                className="field"
              >
                <option value="">— ບໍ່ລະບຸ —</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="ສິນຄ້າ">
              <select
                name="productId"
                defaultValue={lead.productId ?? ""}
                className="field"
              >
                <option value="">— ບໍ່ລະບຸ —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="ຍອດຊື້ (ກີບ)">
              <input
                name="amount"
                type="number"
                min="0"
                step="1000"
                defaultValue={lead.amount}
                className="field"
              />
            </Field>
            <Field label="ຜູ້ຮັບຜິດຊອບ">
              <input
                name="assignee"
                defaultValue={lead.assignee ?? ""}
                className="field"
              />
            </Field>
            <Field label="ໝາຍເຫດ" className="sm:col-span-2">
              <textarea
                name="note"
                rows={2}
                defaultValue={lead.note ?? ""}
                className="field"
              />
            </Field>
            <div className="sm:col-span-2">
              <SubmitButton>ບັນທຶກການແກ້ໄຂ</SubmitButton>
            </div>
          </form>
        </Card>

        <Card>
          <CardHeader title="ລຶບລູກຄ້ານີ້" />
          <form action={remove} className="p-4">
            <DeleteButton label="ລຶບລູກຄ້າ" confirmText={`ລຶບ "${lead.name}"?`} />
          </form>
        </Card>
      </div>
    </>
  );
}
