import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { AdAccountForm } from "@/components/AdAccountForm";
import { createAdAccount } from "./actions";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/labels";
import { formatInt, formatLak } from "@/lib/format";
import { totalsScope } from "@/lib/scope";

export const dynamic = "force-dynamic";

export default async function AdAccountsPage() {
  const accounts = await prisma.adAccount.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { campaigns: true } },
    },
  });

  const spendByAccount = await prisma.insight.groupBy({
    by: ["adAccountId"],
    where: totalsScope,
    _sum: { spendLak: true, impressions: true },
  });
  const spendMap = new Map(
    spendByAccount.map((row) => [
      row.adAccountId,
      {
        spendLak: row._sum.spendLak ?? 0,
        impressions: row._sum.impressions ?? 0,
      },
    ]),
  );

  return (
    <>
      <PageHeader
        title="ບັນຊີໂຄສະນາ"
        description="ບັນຊີທີ່ Facebook ຕັດຄ່າໂຄສະນາ — ທຸກແຄມເປນຕ້ອງຢູ່ພາຍໃຕ້ບັນຊີໃດໜຶ່ງ"
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        <Card>
          <CardHeader
            title="ລາຍການບັນຊີ"
            subtitle={`ທັງໝົດ ${accounts.length} ບັນຊີ`}
          />
          {accounts.length === 0 ? (
            <EmptyState
              title="ຍັງບໍ່ມີບັນຊີໂຄສະນາ"
              hint="ເພີ່ມບັນຊີທຳອິດຢູ່ຟອມທາງຂວາ ເພື່ອເລີ່ມສ້າງແຄມເປນ"
            />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>ຊື່ບັນຊີ</th>
                    <th>FB Account ID</th>
                    <th>ສະກຸນ</th>
                    <th className="num">ແຄມເປນ</th>
                    <th className="num">ໃຊ້ໄປແລ້ວ</th>
                    <th>ສະຖານະ</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => {
                    const stat = spendMap.get(a.id);
                    return (
                      <tr key={a.id}>
                        <td className="font-medium">{a.name}</td>
                        <td className="text-[var(--fg-muted)]">
                          {a.fbAccountId ?? "—"}
                        </td>
                        <td>{a.currency}</td>
                        <td className="num">{formatInt(a._count.campaigns)}</td>
                        <td className="num">{formatLak(stat?.spendLak ?? 0)}</td>
                        <td>
                          <Badge tone={STATUS_TONE[a.status]}>
                            {STATUS_LABEL[a.status]}
                          </Badge>
                        </td>
                        <td className="num">
                          <Link
                            href={`/ad-accounts/${a.id}`}
                            className="btn btn-sm"
                          >
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
          <CardHeader title="ເພີ່ມບັນຊີໃໝ່" />
          <AdAccountForm action={createAdAccount} />
        </Card>
      </div>
    </>
  );
}
