import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { CampaignForm } from "@/components/CampaignForm";
import { DeleteButton } from "@/components/SubmitButton";
import { deleteCampaign, updateCampaign } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [campaign, accounts, pages, products] = await Promise.all([
    prisma.campaign.findUnique({
      where: { id },
      include: { _count: { select: { adSets: true, insights: true } } },
    }),
    prisma.adAccount.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.fbPage.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!campaign) notFound();

  const update = updateCampaign.bind(null, id);
  const remove = deleteCampaign.bind(null, id);

  return (
    <>
      <PageHeader
        title="ແກ້ໄຂແຄມເປນ"
        description={campaign.name}
        action={
          <Link href={`/campaigns/${id}`} className="btn">
            ← ກັບຄືນ
          </Link>
        }
      />

      <div className="grid max-w-3xl gap-5">
        <Card>
          <CardHeader title="ຂໍ້ມູນແຄມເປນ" />
          <CampaignForm
            action={update}
            campaign={campaign}
            accounts={accounts}
            pages={pages}
            products={products}
            submitLabel="ບັນທຶກການແກ້ໄຂ"
          />
        </Card>

        <Card>
          <CardHeader
            title="ລຶບແຄມເປນນີ້"
            subtitle={`ຈະລຶບ ${campaign._count.adSets} ຊຸດໂຄສະນາ ແລະ ${campaign._count.insights} ແຖວຜົນລາຍວັນ ອອກນຳ`}
          />
          <form action={remove} className="p-4">
            <DeleteButton
              label="ລຶບແຄມເປນ"
              confirmText={`ລຶບ "${campaign.name}" ພ້ອມຊຸດໂຄສະນາ, ໂຄສະນາ ແລະ ຜົນລາຍວັນທັງໝົດ? ກູ້ຄືນບໍ່ໄດ້.`}
            />
          </form>
        </Card>
      </div>
    </>
  );
}
