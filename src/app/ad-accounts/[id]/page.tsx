import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { AdAccountForm } from "@/components/AdAccountForm";
import { DeleteButton } from "@/components/SubmitButton";
import { deleteAdAccount, updateAdAccount } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditAdAccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const account = await prisma.adAccount.findUnique({
    where: { id },
    include: { _count: { select: { campaigns: true, insights: true } } },
  });
  if (!account) notFound();

  const update = updateAdAccount.bind(null, id);
  const remove = deleteAdAccount.bind(null, id);

  return (
    <>
      <PageHeader
        title={account.name}
        description="ແກ້ໄຂຂໍ້ມູນບັນຊີໂຄສະນາ"
        action={
          <Link href="/ad-accounts" className="btn">
            ← ກັບຄືນ
          </Link>
        }
      />

      <div className="grid max-w-3xl gap-5">
        <Card>
          <CardHeader title="ຂໍ້ມູນບັນຊີ" />
          <AdAccountForm action={update} account={account} />
        </Card>

        <Card>
          <CardHeader
            title="ລຶບບັນຊີນີ້"
            subtitle={`ຈະລຶບ ${account._count.campaigns} ແຄມເປນ ແລະ ${account._count.insights} ແຖວຜົນລາຍວັນ ອອກນຳ`}
          />
          <form action={remove} className="p-4">
            <DeleteButton
              label="ລຶບບັນຊີໂຄສະນາ"
              confirmText={`ລຶບ "${account.name}" ພ້ອມແຄມເປນ ແລະ ຜົນລາຍວັນທັງໝົດ? ກູ້ຄືນບໍ່ໄດ້.`}
            />
          </form>
        </Card>
      </div>
    </>
  );
}
