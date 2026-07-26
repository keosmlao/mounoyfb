import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { DeleteButton, SubmitButton } from "@/components/SubmitButton";
import { deleteInsight, saveDailyInsights } from "./actions";
import { addDays, formatDateLao, parseDate, todayStr } from "@/lib/date";
import { formatCompact, formatLak } from "@/lib/format";
import { LEVEL_LABEL, SOURCE_LABEL } from "@/lib/labels";
import type { EntityStatus } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

const METRICS = [
  { key: "spend", label: "ຄ່າໂຄສະນາ", step: "0.01", width: "w-24" },
  { key: "impressions", label: "ເຫັນ", step: "1", width: "w-24" },
  { key: "reach", label: "ເຂົ້າເຖິງ", step: "1", width: "w-24" },
  { key: "clicks", label: "ຄລິກ", step: "1", width: "w-20" },
  { key: "linkClicks", label: "ຄລິກລິ້ງ", step: "1", width: "w-20" },
  { key: "messages", label: "ທັກແຊັດ", step: "1", width: "w-20" },
  { key: "leadsCount", label: "ລາຍຊື່", step: "1", width: "w-20" },
  { key: "purchases", label: "ອໍເດີ", step: "1", width: "w-20" },
  { key: "revenue", label: "ຍອດຂາຍ (ກີບ)", step: "1000", width: "w-32" },
] as const;

type Search = { date?: string; account?: string; campaign?: string };

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const dateStr = sp.date ?? addDays(todayStr(), -1); // ປົກກະຕິບັນທຶກຜົນຂອງມື້ວານ
  const date = parseDate(dateStr);

  const [accounts, campaigns, existing, recent, savedRate] = await Promise.all([
    prisma.adAccount.findMany({ orderBy: { name: "asc" } }),
    prisma.campaign.findMany({
      where: {
        status: { in: ["ACTIVE", "PAUSED", "DRAFT"] as EntityStatus[] },
        ...(sp.account ? { adAccountId: sp.account } : {}),
        ...(sp.campaign ? { id: sp.campaign } : {}),
      },
      orderBy: [{ adAccountId: "asc" }, { name: "asc" }],
      include: { adAccount: { select: { name: true, currency: true } } },
    }),
    prisma.insight.findMany({
      where: { date, level: "CAMPAIGN" },
    }),
    prisma.insight.findMany({
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 40,
      include: {
        campaign: { select: { name: true } },
        adSet: { select: { name: true } },
        ad: { select: { name: true } },
        adAccount: { select: { name: true } },
      },
    }),
    prisma.exchangeRate.findFirst({
      where: { currency: "USD" },
      orderBy: { date: "desc" },
    }),
  ]);

  const existingByCampaign = new Map(
    existing.filter((r) => r.campaignId).map((r) => [r.campaignId as string, r]),
  );

  const defaultFx =
    existing.find((r) => r.fxRateToLak > 1)?.fxRateToLak ??
    savedRate?.rateToLak ??
    21700;

  const dayTotal = existing.reduce(
    (acc, r) => {
      acc.spendLak += r.spendLak;
      acc.messages += r.messages;
      acc.revenue += r.revenue;
      return acc;
    },
    { spendLak: 0, messages: 0, revenue: 0 },
  );

  return (
    <>
      <PageHeader
        title="ບັນທຶກຜົນລາຍວັນ"
        description="ປ້ອນຄ່າໂຄສະນາ ແລະ ຜົນທີ່ໄດ້ຂອງແຕ່ລະແຄມເປນ — ບັນທຶກທຸກແຖວພ້ອມກັນຄັ້ງດຽວ"
      />

      <Card className="mb-5">
        <form
          method="get"
          action="/insights"
          className="flex flex-wrap items-end gap-3 p-3"
        >
          <div>
            <label className="label">ວັນທີ່</label>
            <input type="date" name="date" defaultValue={dateStr} className="field" />
          </div>
          <div>
            <label className="label">ບັນຊີໂຄສະນາ</label>
            <select name="account" defaultValue={sp.account ?? ""} className="field">
              <option value="">ທັງໝົດ</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn">
            ໂຫຼດວັນນີ້
          </button>
          <div className="ml-auto flex flex-wrap gap-1.5">
            <Link
              href={`/insights?date=${addDays(dateStr, -1)}`}
              className="btn btn-sm"
            >
              ← ວັນກ່ອນ
            </Link>
            <Link
              href={`/insights?date=${addDays(todayStr(), -1)}`}
              className="btn btn-sm"
            >
              ມື້ວານ
            </Link>
            <Link href={`/insights?date=${todayStr()}`} className="btn btn-sm">
              ມື້ນີ້
            </Link>
            <Link
              href={`/insights?date=${addDays(dateStr, 1)}`}
              className="btn btn-sm"
            >
              ວັນຖັດໄປ →
            </Link>
          </div>
        </form>
      </Card>

      <Card className="mb-5">
        <CardHeader
          title={`ຕາຕະລາງປ້ອນຂໍ້ມູນ — ${formatDateLao(dateStr)}`}
          subtitle={`ວັນນີ້ບັນທຶກແລ້ວ ${existing.length} ແຄມເປນ · ຄ່າໂຄສະນາ ${formatLak(
            dayTotal.spendLak,
          )} · ທັກແຊັດ ${formatCompact(dayTotal.messages)} · ຍອດຂາຍ ${formatLak(
            dayTotal.revenue,
          )}`}
        />

        {campaigns.length === 0 ? (
          <EmptyState
            title="ບໍ່ມີແຄມເປນໃຫ້ບັນທຶກ"
            hint="ສ້າງແຄມເປນກ່ອນ ຫຼື ລອງລ້າງຕົວກັ່ນຕອງບັນຊີໂຄສະນາ"
            action={
              <Link href="/campaigns/new" className="btn btn-primary">
                + ສ້າງແຄມເປນ
              </Link>
            }
          />
        ) : (
          <form action={saveDailyInsights}>
            <input type="hidden" name="date" value={dateStr} />

            <div className="flex flex-wrap items-end gap-3 border-b border-[var(--border)] px-4 py-3">
              <div>
                <label className="label">ອັດຕາແລກປ່ຽນ 1 USD = ? ກີບ</label>
                <input
                  name="fxRateToLak"
                  type="number"
                  step="1"
                  min="1"
                  defaultValue={defaultFx}
                  className="field w-40"
                />
              </div>
              <p className="pb-2 text-xs text-[var(--fg-subtle)]">
                ໃຊ້ແປງຄ່າໂຄສະນາເປັນກີບ — ນຳໃຊ້ກັບທຸກແຖວໃນວັນນີ້
              </p>
            </div>

            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-[var(--surface-2)]">
                      ແຄມເປນ
                    </th>
                    {METRICS.map((m) => (
                      <th key={m.key} className="num">
                        {m.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => {
                    const row = existingByCampaign.get(c.id);
                    return (
                      <tr key={c.id}>
                        <td className="sticky left-0 z-10 bg-[var(--surface)] font-medium">
                          <input type="hidden" name="campaignId" value={c.id} />
                          {c.name}
                          <div className="text-xs font-normal text-[var(--fg-subtle)]">
                            {c.adAccount.name} · {c.adAccount.currency}
                          </div>
                        </td>
                        {METRICS.map((m) => (
                          <td key={m.key} className="num">
                            <input
                              name={`${m.key}_${c.id}`}
                              type="number"
                              step={m.step}
                              min="0"
                              defaultValue={
                                row
                                  ? (row[m.key as keyof typeof row] as number)
                                  : ""
                              }
                              placeholder="0"
                              className={`field tnum ${m.width} text-right`}
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] p-4">
              <SubmitButton>ບັນທຶກທັງໝົດ</SubmitButton>
              <p className="text-xs text-[var(--fg-subtle)]">
                ແຖວທີ່ປະວ່າງທັງໝົດຈະບໍ່ຖືກບັນທຶກ — ຖ້າລຶບຄ່າອອກໝົດ ແຖວເກົ່າຈະຖືກລຶບ
              </p>
            </div>
          </form>
        )}
      </Card>

      <Card>
        <CardHeader
          title="ບັນທຶກຫຼ້າສຸດ"
          subtitle="40 ແຖວລ່າສຸດ ຈາກທຸກລະດັບ"
        />
        {recent.length === 0 ? (
          <EmptyState title="ຍັງບໍ່ມີການບັນທຶກ" />
        ) : (
          <div className="table-wrap max-h-[32rem] overflow-y-auto">
            <table className="data">
              <thead>
                <tr>
                  <th>ວັນທີ່</th>
                  <th>ລະດັບ</th>
                  <th>ເປົ້າໝາຍ</th>
                  <th className="num">ຄ່າໂຄສະນາ</th>
                  <th className="num">ເຫັນ</th>
                  <th className="num">ຄລິກ</th>
                  <th className="num">ທັກ</th>
                  <th className="num">ອໍເດີ</th>
                  <th className="num">ຍອດຂາຍ</th>
                  <th>ທີ່ມາ</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => {
                  const remove = deleteInsight.bind(null, r.id);
                  const target =
                    r.ad?.name ??
                    r.adSet?.name ??
                    r.campaign?.name ??
                    r.adAccount.name;
                  return (
                    <tr key={r.id}>
                      <td>{formatDateLao(r.date)}</td>
                      <td className="text-xs">{LEVEL_LABEL[r.level]}</td>
                      <td className="max-w-56 truncate">{target}</td>
                      <td className="num">{formatLak(r.spendLak)}</td>
                      <td className="num">{formatCompact(r.impressions)}</td>
                      <td className="num">{formatCompact(r.clicks)}</td>
                      <td className="num">{r.messages}</td>
                      <td className="num">{r.purchases}</td>
                      <td className="num">{formatLak(r.revenue)}</td>
                      <td className="text-xs text-[var(--fg-muted)]">
                        {SOURCE_LABEL[r.source]}
                      </td>
                      <td className="num">
                        <form action={remove}>
                          <DeleteButton
                            label="ລຶບ"
                            confirmText={`ລຶບຜົນຂອງ ${target} ວັນທີ່ ${formatDateLao(r.date)}?`}
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
    </>
  );
}
