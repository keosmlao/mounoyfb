import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { CampaignForm } from "@/components/CampaignForm";
import { createCampaign } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  const [accounts, pages, products] = await Promise.all([
    prisma.adAccount.findMany({
      where: { status: { not: "ARCHIVED" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.fbPage.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="ສ້າງແຄມເປນໃໝ່"
        action={
          <Link href="/campaigns" className="btn">
            ← ກັບຄືນ
          </Link>
        }
      />

      <Card className="max-w-3xl">
        <CardHeader title="ຂໍ້ມູນແຄມເປນ" />
        {accounts.length === 0 ? (
          <EmptyState
            title="ຕ້ອງມີບັນຊີໂຄສະນາກ່ອນ"
            hint="ສ້າງບັນຊີໂຄສະນາຢ່າງໜ້ອຍ 1 ບັນຊີ ແລ້ວຈຶ່ງກັບມາສ້າງແຄມເປນ"
            action={
              <Link href="/ad-accounts" className="btn btn-primary">
                ໄປໜ້າບັນຊີໂຄສະນາ
              </Link>
            }
          />
        ) : (
          <CampaignForm
            action={createCampaign}
            accounts={accounts}
            pages={pages}
            products={products}
            submitLabel="ສ້າງແຄມເປນ"
          />
        )}
      </Card>
    </>
  );
}
