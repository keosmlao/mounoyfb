import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { AdAccountForm } from "@/components/AdAccountForm";
import { DeleteButton } from "@/components/SubmitButton";
import { deleteAdAccount, updateAdAccount } from "../actions";
import { formatMoney } from "@/lib/format";
import { formatDateLao } from "@/lib/date";

export const dynamic = "force-dynamic";

/** ແຖວ "ຫົວຂໍ້ / ຄ່າ" ຂອງບັດການຊຳລະ */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--border)] px-4 py-2.5 last:border-0">
      <span className="text-xs text-[var(--fg-muted)]">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

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

        {account.fbAccountId && (
          <Card>
            <CardHeader
              title="ການຊຳລະຢູ່ Facebook"
              subtitle={
                account.fbBillingAt
                  ? `ດຶງມາເມື່ອ ${formatDateLao(account.fbBillingAt)} — ອ່ານຢ່າງດຽວ, ແກ້ໄດ້ຢູ່ Ads Manager`
                  : "ຍັງບໍ່ເຄີຍດຶງ — ກົດ “ນຳເຂົ້າບັນຊີ ແລະ ເພຈ” ຢູ່ໜ້າ ຕັ້ງຄ່າ"
              }
            />
            {account.fbBillingAt && (
              <div>
                <Row
                  label="ວິທີຊຳລະ"
                  value={account.fbFundingSource ?? "—"}
                />
                <Row
                  label="ບັນຊີທຸລະກິດ"
                  value={account.fbBusinessName ?? "—"}
                />
                <Row
                  label="ຍອດຄ້າງຊຳລະ"
                  value={
                    account.fbBalance === null
                      ? "—"
                      : formatMoney(account.fbBalance, account.currency)
                  }
                />
                <Row
                  label="ໃຊ້ໄປແລ້ວທັງໝົດ"
                  value={
                    account.fbAmountSpent === null
                      ? "—"
                      : formatMoney(account.fbAmountSpent, account.currency)
                  }
                />
                <Row
                  label="ເພດານທີ່ຕັ້ງຢູ່ Facebook"
                  value={
                    account.fbSpendCap === null
                      ? "—"
                      : account.fbSpendCap === 0
                        ? "ບໍ່ໄດ້ຕັ້ງ — ໃຊ້ຈ່າຍໄດ້ບໍ່ຈຳກັດ"
                        : formatMoney(account.fbSpendCap, account.currency)
                  }
                />
              </div>
            )}
          </Card>
        )}

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
