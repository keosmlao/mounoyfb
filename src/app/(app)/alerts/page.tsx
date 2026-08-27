import Link from "next/link";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { AlertList } from "@/components/AlertList";
import { buildAlerts, SEVERITY_LABEL, type Severity } from "@/lib/alerts";

export const dynamic = "force-dynamic";

const GROUPS: Severity[] = ["critical", "serious", "warning", "info"];

export default async function AlertsPage() {
  const alerts = await buildAlerts();

  return (
    <>
      <PageHeader
        title="ການແຈ້ງເຕືອນ"
        description="ຄິດໃໝ່ຈາກຂໍ້ມູນປັດຈຸບັນທຸກຄັ້ງທີ່ເປີດໜ້ານີ້ — ແກ້ຂໍ້ມູນແລ້ວການເຕືອນຈະຫາຍໄປເອງ"
        action={
          <Link href="/settings#alerts" className="btn">
            ຕັ້ງເກນການເຕືອນ
          </Link>
        }
      />

      {alerts.length === 0 ? (
        <Card>
          <EmptyState
            title="ບໍ່ມີຫຍັງຕ້ອງເບິ່ງ"
            hint="ງົບປະມານຢູ່ໃນເກນ, ROAS ຜ່ານເປົ້າ, ຂໍ້ມູນລາຍວັນຄົບ ແລະ ບໍ່ມີລູກຄ້າຄ້າງ"
          />
        </Card>
      ) : (
        <div className="grid gap-3">
          {GROUPS.map((severity) => {
            const group = alerts.filter((a) => a.severity === severity);
            if (group.length === 0) return null;
            return (
              <Card key={severity}>
                <CardHeader
                  title={SEVERITY_LABEL[severity]}
                  subtitle={`${group.length} ລາຍການ`}
                />
                <AlertList alerts={group} />
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
