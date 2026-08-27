import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge, Card, CardHeader, EmptyState, Field, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { createFbPage } from "./actions";
import { linkPages } from "../inbox/actions";
import { STATUS_LABEL, STATUS_TONE, options } from "@/lib/labels";
import { formatInt } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function FbPagesPage() {
  const pages = await prisma.fbPage.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { campaigns: true, comments: true, threads: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="ເພຈ Facebook"
        description="ເພຈທີ່ໃຊ້ຍິງໂຄສະນາ — ໃຊ້ແຍກວ່າແຄມເປນໃດຍິງຈາກເພຈໃດ ແລະ ຕິດຕາມ comment/ແຊັດ"
        action={
          <form action={linkPages}>
            <SubmitButton pendingText="ກຳລັງເຊື່ອມ...">
              ເຊື່ອມເພຈກັບ Facebook
            </SubmitButton>
          </form>
        }
      />

      <p className="mb-4 text-xs text-[var(--fg-subtle)]">
        “ເຊື່ອມເພຈກັບ Facebook” ຈະດຶງລາຍການເພຈ ພ້ອມ page token ຂອງແຕ່ລະເພຈ —
        ຕ້ອງມີແລ້ວຈຶ່ງອ່ານ/ຕອບ comment ແລະ ແຊັດໄດ້ (token ຫຼັກໃນໜ້າຕັ້ງຄ່າ
        ໃຊ້ໄດ້ແຕ່ຝັ່ງໂຄສະນາ). ຕ້ອງການສິດ pages_read_engagement,
        pages_read_user_content, pages_manage_engagement ແລະ pages_messaging.
      </p>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader title="ລາຍການເພຈ" subtitle={`ທັງໝົດ ${pages.length} ເພຈ`} />
          {pages.length === 0 ? (
            <EmptyState title="ຍັງບໍ່ມີເພຈ" hint="ເພີ່ມເພຈຢູ່ຟອມທາງຂວາ" />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>ຊື່ເພຈ</th>
                    <th>Page ID</th>
                    <th>ໝວດ</th>
                    <th className="num">ແຄມເປນ</th>
                    <th>ກ່ອງຂໍ້ຄວາມ</th>
                    <th>ສະຖານະ</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {pages.map((p) => (
                    <tr key={p.id}>
                      <td className="font-medium">{p.name}</td>
                      <td className="text-[var(--fg-muted)]">
                        {p.fbPageId ?? "—"}
                      </td>
                      <td>{p.category ?? "—"}</td>
                      <td className="num">{formatInt(p._count.campaigns)}</td>
                      <td className="text-xs">
                        {!p.token ? (
                          <Badge tone="warning">ຍັງບໍ່ມີ token</Badge>
                        ) : !p.inboxOn ? (
                          <Badge>ປິດຕິດຕາມ</Badge>
                        ) : (
                          <span className="text-[var(--fg-muted)]">
                            comment {formatInt(p._count.comments)} · ແຊັດ{" "}
                            {formatInt(p._count.threads)}
                          </span>
                        )}
                      </td>
                      <td>
                        <Badge tone={STATUS_TONE[p.status]}>
                          {STATUS_LABEL[p.status]}
                        </Badge>
                      </td>
                      <td className="num">
                        <Link href={`/fb-pages/${p.id}`} className="btn btn-sm">
                          ແກ້ໄຂ
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="h-fit">
          <CardHeader title="ເພີ່ມເພຈໃໝ່" />
          <form action={createFbPage} className="grid gap-4 p-4">
            <Field label="ຊື່ເພຈ *">
              <input name="name" required className="field" placeholder="Odien Maall" />
            </Field>
            <Field label="Facebook Page ID" hint="ວ່າງໄດ້ ຖ້າຍັງບໍ່ຕໍ່ API">
              <input name="fbPageId" className="field" placeholder="100000000001" />
            </Field>
            <Field label="ໝວດໝູ່">
              <input name="category" className="field" placeholder="ຮ້ານຄ້າ" />
            </Field>
            <Field label="ສະຖານະ">
              <select name="status" defaultValue="ACTIVE" className="field">
                {options(STATUS_LABEL).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="ໝາຍເຫດ">
              <textarea name="note" rows={2} className="field" />
            </Field>
            <SubmitButton>ເພີ່ມເພຈ</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
