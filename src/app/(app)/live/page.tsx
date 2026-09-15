import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge, Card, CardHeader, EmptyState, Field, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { createLive } from "./actions";
import { formatDateLao, todayStr } from "@/lib/date";
import { formatInt } from "@/lib/format";
import { loadMoney } from "@/lib/money-server";
import { LIVE_STATUS_LABEL, LIVE_STATUS_TONE } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function LiveListPage() {
  const { money } = await loadMoney();
  const [lives, pages] = await Promise.all([
    prisma.liveSession.findMany({
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 100,
      include: {
        page: { select: { name: true } },
        _count: { select: { claims: true, items: true, orders: true } },
      },
    }),
    prisma.fbPage.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, token: true },
    }),
  ]);

  // ຍອດບິນຕໍ່ live — ລວມໃນຖານຂໍ້ມູນ ບໍ່ດຶງ Order ທັງໝົດມາບວກເອງ
  const sales = await prisma.order.groupBy({
    by: ["liveSessionId"],
    where: { liveSessionId: { in: lives.map((l) => l.id) }, status: { not: "CANCELLED" } },
    _sum: { saleAmount: true },
  });
  const saleBy = new Map(sales.map((s) => [s.liveSessionId, s._sum.saleAmount ?? 0]));

  // ຄົນເບິ່ງຫຼ້າສຸດຂອງແຕ່ລະ live (ຈາກ Facebook) — ຈຸດສຸດທ້າຍທີ່ມີຄ່າ
  const stats = await prisma.liveStat.findMany({
    where: { sessionId: { in: lives.map((l) => l.id) }, viewers: { not: null } },
    orderBy: { at: "desc" },
    distinct: ["sessionId"],
    select: { sessionId: true, viewers: true },
  });
  const viewersBy = new Map(stats.map((s) => [s.sessionId, s.viewers]));

  return (
    <>
      <PageHeader
        title="ຂາຍຜ່ານ live (CF)"
        description="ລູກຄ້າ comment “CF ລະຫັດ” ລະຫວ່າງ live — ລະບົບຈັດຄິວມາກ່ອນໄດ້ກ່ອນ, ລວມບິນຕໍ່ຄົນ ແລະ ສົ່ງສະຫຼຸບຍອດເຂົ້າ Messenger"
      />

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader title="ຮອບ live" subtitle={`${formatInt(lives.length)} ຮອບຫຼ້າສຸດ`} />
          {lives.length === 0 ? (
            <EmptyState
              title="ຍັງບໍ່ມີຮອບ live"
              hint="ສ້າງຮອບ live ຢູ່ຟອມທາງຂວາ ແລ້ວຕັ້ງລະຫັດສິນຄ້າກ່ອນເລີ່ມ live"
            />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>ວັນທີ່ / ຮອບ</th>
                    <th>ເພຈ</th>
                    <th className="num">ຄົນເບິ່ງ</th>
                    <th className="num">ສິນຄ້າ</th>
                    <th className="num">CF</th>
                    <th className="num">ບິນ</th>
                    <th className="num">ຍອດບິນ</th>
                    <th>ສະຖານະ</th>
                  </tr>
                </thead>
                <tbody>
                  {lives.map((live) => (
                    <tr key={live.id}>
                      <td>
                        <Link href={`/live/${live.id}`} className="link font-medium">
                          {live.title}
                        </Link>
                        <div className="text-xs text-[var(--fg-subtle)]">
                          {formatDateLao(live.date)} ·{" "}
                          <Link href={`/live/${live.id}/report`} className="link">ວິເຄາະ</Link>
                        </div>
                      </td>
                      <td className="text-xs">{live.page.name}</td>
                      <td className="num">{viewersBy.has(live.id) ? formatInt(viewersBy.get(live.id)) : "—"}</td>
                      <td className="num">{formatInt(live._count.items)}</td>
                      <td className="num">{formatInt(live._count.claims)}</td>
                      <td className="num">{formatInt(live._count.orders)}</td>
                      <td className="num">{money(saleBy.get(live.id) ?? 0)}</td>
                      <td>
                        <Badge tone={LIVE_STATUS_TONE[live.status]}>{LIVE_STATUS_LABEL[live.status]}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="h-fit">
          <CardHeader title="ສ້າງຮອບ live" subtitle="ຜູກວິດີໂອໄດ້ພາຍຫຼັງ" />
          {pages.length === 0 ? (
            <EmptyState
              title="ຍັງບໍ່ມີເພຈ"
              action={<Link href="/fb-pages" className="btn btn-sm">ໄປໜ້າເພຈ</Link>}
            />
          ) : (
            <form action={createLive} className="grid gap-3 p-4">
              <Field label="ຊື່ຮອບ">
                <input name="title" required className="field w-full" placeholder="ເຊັ່ນ Live ເສື້ອຜ້າ ຄືນວັນສຸກ" />
              </Field>
              <Field label="ເພຈ">
                <select name="pageId" required className="field w-full">
                  {pages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.token ? "" : " (ຍັງບໍ່ມີ page token)"}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="ວັນທີ່ຂອງບິນ">
                <input name="date" type="date" required defaultValue={todayStr()} className="field w-full" />
              </Field>
              <Field label="ລິ້ງ ຫຼື id ວິດີໂອ live" hint="ປະວ່າງໄວ້ໄດ້ — ເລືອກຈາກລາຍການ live ຂອງເພຈໃນໜ້າຖັດໄປ">
                <input name="video" className="field w-full" placeholder="https://www.facebook.com/.../videos/123..." />
              </Field>
              <SubmitButton>ສ້າງ ແລ້ວຕັ້ງສິນຄ້າ</SubmitButton>
            </form>
          )}
        </Card>
      </div>
    </>
  );
}
