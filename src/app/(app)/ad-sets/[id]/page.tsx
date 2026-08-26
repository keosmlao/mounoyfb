import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  Field,
  PageHeader,
} from "@/components/ui";
import { DeleteButton, SubmitButton } from "@/components/SubmitButton";
import {
  createAd,
  deleteAd,
  deleteAdSet,
  updateAdSet,
} from "@/app/(app)/campaigns/actions";
import { saveSingleInsight } from "@/app/(app)/insights/actions";
import { CREATIVE_TYPES, STATUS_LABEL, STATUS_TONE, options } from "@/lib/labels";
import { addDays, toDateInput, todayStr } from "@/lib/date";
import { formatCompact, formatLak } from "@/lib/format";

export const dynamic = "force-dynamic";

const ADSET_METRICS = [
  { key: "spend", label: "ຄ່າໂຄສະນາ", step: "0.01" },
  { key: "impressions", label: "ຄັ້ງທີ່ເຫັນ", step: "1" },
  { key: "reach", label: "ເຂົ້າເຖິງ", step: "1" },
  { key: "clicks", label: "ຄລິກ", step: "1" },
  { key: "messages", label: "ທັກແຊັດ", step: "1" },
  { key: "purchases", label: "ອໍເດີ", step: "1" },
  { key: "revenue", label: "ຍອດຂາຍ (ກີບ)", step: "1000" },
] as const;

export default async function AdSetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const adSet = await prisma.adSet.findUnique({
    where: { id },
    include: {
      campaign: { include: { adAccount: { select: { currency: true } } } },
      ads: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!adSet) notFound();

  const fxSetting = await prisma.appSetting.findUnique({
    where: { key: "defaultFxRateToLak" },
  });
  const defaultFx =
    adSet.campaign.adAccount.currency === "LAK"
      ? 1
      : Number(fxSetting?.value) || 21700;

  const adTotals = await prisma.insight.groupBy({
    by: ["adId"],
    where: { level: "AD", adId: { in: adSet.ads.map((a) => a.id) } },
    _sum: { spendLak: true, impressions: true, clicks: true, messages: true },
  });
  const adMap = new Map(adTotals.map((g) => [g.adId as string, g._sum]));

  const update = updateAdSet.bind(null, id);
  const remove = deleteAdSet.bind(null, id);
  const addAd = createAd.bind(null, id);

  return (
    <>
      <PageHeader
        title={adSet.name}
        description={`ຊຸດໂຄສະນາໃນແຄມເປນ “${adSet.campaign.name}”`}
        action={
          <Link href={`/campaigns/${adSet.campaignId}`} className="btn">
            ← ກັບໄປແຄມເປນ
          </Link>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="grid gap-5">
          <Card>
            <CardHeader
              title="ໂຄສະນາ (Ads)"
              subtitle={`${adSet.ads.length} ຊິ້ນ`}
            />
            {adSet.ads.length === 0 ? (
              <EmptyState
                title="ຍັງບໍ່ມີໂຄສະນາ"
                hint="ເພີ່ມຊິ້ນໂຄສະນາ (ຮູບ / ວິດີໂອ / ຄາຣູແຊວ) ຢູ່ຟອມທາງຂວາ"
              />
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>ຊື່ໂຄສະນາ</th>
                      <th>ປະເພດ</th>
                      <th>ຫົວຂໍ້</th>
                      <th>ສະຖານະ</th>
                      <th className="num">ຄ່າໂຄສະນາ</th>
                      <th className="num">ຄລິກ</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {adSet.ads.map((ad) => {
                      const sum = adMap.get(ad.id);
                      const removeAd = deleteAd.bind(null, ad.id);
                      return (
                        <tr key={ad.id}>
                          <td className="font-medium">{ad.name}</td>
                          <td className="text-xs">{ad.creativeType ?? "—"}</td>
                          <td className="max-w-56 truncate text-xs text-[var(--fg-muted)]">
                            {ad.headline ?? "—"}
                          </td>
                          <td>
                            <Badge tone={STATUS_TONE[ad.status]}>
                              {STATUS_LABEL[ad.status]}
                            </Badge>
                          </td>
                          <td className="num">{formatLak(sum?.spendLak ?? 0)}</td>
                          <td className="num">{formatCompact(sum?.clicks ?? 0)}</td>
                          <td className="num">
                            <form action={removeAd}>
                              <DeleteButton
                                label="ລຶບ"
                                confirmText={`ລຶບໂຄສະນາ "${ad.name}"?`}
                              />
                            </form>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="ຂໍ້ມູນຊຸດໂຄສະນາ" />
            <form action={update} className="grid gap-4 p-4 sm:grid-cols-2">
              <Field label="ຊື່ຊຸດ *" className="sm:col-span-2">
                <input name="name" required defaultValue={adSet.name} className="field" />
              </Field>
              <Field label="ກຸ່ມເປົ້າໝາຍ" className="sm:col-span-2">
                <textarea
                  name="audience"
                  rows={2}
                  defaultValue={adSet.audience ?? ""}
                  className="field"
                />
              </Field>
              <Field label="ຕຳແໜ່ງສະແດງ" className="sm:col-span-2">
                <input
                  name="placements"
                  defaultValue={adSet.placements ?? ""}
                  className="field"
                />
              </Field>
              <Field label={`ງົບຕໍ່ວັນ (${adSet.campaign.adAccount.currency})`}>
                <input
                  name="dailyBudget"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={adSet.dailyBudget ?? ""}
                  className="field"
                />
              </Field>
              <Field label="ງົບລວມ">
                <input
                  name="lifetimeBudget"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={adSet.lifetimeBudget ?? ""}
                  className="field"
                />
              </Field>
              <Field label="ເປົ້າໝາຍການປັບແຕ່ງ (optimization goal)">
                <input
                  name="optimizationGoal"
                  defaultValue={adSet.optimizationGoal ?? ""}
                  className="field"
                  placeholder="CONVERSATIONS"
                />
              </Field>
              <Field label="ຮູບແບບຄິດເງິນ (billing event)">
                <input
                  name="billingEvent"
                  defaultValue={adSet.billingEvent ?? ""}
                  className="field"
                  placeholder="IMPRESSIONS"
                />
              </Field>
              <Field label="ວັນເລີ່ມ">
                <input
                  name="startDate"
                  type="date"
                  defaultValue={adSet.startDate ? toDateInput(adSet.startDate) : ""}
                  className="field"
                />
              </Field>
              <Field label="ວັນສິ້ນສຸດ">
                <input
                  name="endDate"
                  type="date"
                  defaultValue={adSet.endDate ? toDateInput(adSet.endDate) : ""}
                  className="field"
                />
              </Field>
              <Field label="Facebook Ad Set ID">
                <input
                  name="fbAdSetId"
                  defaultValue={adSet.fbAdSetId ?? ""}
                  className="field"
                />
              </Field>
              <Field label="ສະຖານະ">
                <select name="status" defaultValue={adSet.status} className="field">
                  {options(STATUS_LABEL).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="flex gap-2 sm:col-span-2">
                <SubmitButton>ບັນທຶກການແກ້ໄຂ</SubmitButton>
              </div>
            </form>
          </Card>

          <Card>
            <CardHeader title="ລຶບຊຸດໂຄສະນານີ້" subtitle="ໂຄສະນາທັງໝົດໃນຊຸດຈະຖືກລຶບນຳ" />
            <form action={remove} className="p-4">
              <DeleteButton
                label="ລຶບຊຸດໂຄສະນາ"
                confirmText={`ລຶບ "${adSet.name}" ພ້ອມໂຄສະນາທັງໝົດ?`}
              />
            </form>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader
            title="ບັນທຶກຜົນຂອງຊຸດນີ້"
            subtitle="ລາຍລະອຽດລະດັບຊຸດ — ບໍ່ຖືກນັບຊ້ຳໃນຍອດລວມຂອງແຄມເປນ"
          />
          <form action={saveSingleInsight} className="grid gap-3 p-4 sm:grid-cols-2">
            <input type="hidden" name="level" value="ADSET" />
            <input type="hidden" name="targetId" value={adSet.id} />
            <Field label="ວັນທີ່ *" className="sm:col-span-2">
              <input
                name="date"
                type="date"
                required
                defaultValue={addDays(todayStr(), -1)}
                className="field"
              />
            </Field>
            <Field label="ອັດຕາແລກປ່ຽນ (→ ກີບ)" className="sm:col-span-2">
              <input
                name="fxRateToLak"
                type="number"
                step="1"
                min="1"
                defaultValue={defaultFx}
                className="field"
              />
            </Field>
            {ADSET_METRICS.map((m) => (
              <Field key={m.key} label={m.label}>
                <input
                  name={`${m.key}_row`}
                  type="number"
                  step={m.step}
                  min="0"
                  placeholder="0"
                  className="field tnum text-right"
                />
              </Field>
            ))}
            <div className="sm:col-span-2">
              <SubmitButton>ບັນທຶກຜົນ</SubmitButton>
            </div>
          </form>
        </Card>

        <Card className="h-fit">
          <CardHeader title="ເພີ່ມໂຄສະນາ" />
          <form action={addAd} className="grid gap-4 p-4">
            <Field label="ຊື່ໂຄສະນາ *">
              <input name="name" required className="field" placeholder="ວິດີໂອຮີວິວ 30 ວິ" />
            </Field>
            <Field label="ປະເພດຊິ້ນງານ">
              <select name="creativeType" defaultValue="IMAGE" className="field">
                {CREATIVE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="ຫົວຂໍ້ (headline)">
              <input name="headline" className="field" />
            </Field>
            <Field label="ຂໍ້ຄວາມຫຼັກ">
              <textarea name="primaryText" rows={3} className="field" />
            </Field>
            <Field label="ປຸ່ມ (call to action)">
              <input name="callToAction" className="field" placeholder="ສົ່ງຂໍ້ຄວາມ" />
            </Field>
            <Field label="ລິ້ງໂພສ / ຊິ້ນງານ">
              <input name="postUrl" className="field" placeholder="https://facebook.com/..." />
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
            <SubmitButton>ເພີ່ມໂຄສະນາ</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
