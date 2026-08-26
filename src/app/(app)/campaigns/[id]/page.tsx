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
import { SubmitButton } from "@/components/SubmitButton";
import { StatTile } from "@/components/StatTile";
import { TrendChart } from "@/components/charts/TrendChart";
import { DateRangeBar } from "@/components/DateRangeBar";
import { createAdSet } from "../actions";
import {
  eachDay,
  formatDateLao,
  formatDayShort,
  parseDate,
  previousRange,
  resolveRange,
  toDateInput,
} from "@/lib/date";
import { aggregate, groupTotals } from "@/lib/metrics";
import { formatCompact, formatPercent } from "@/lib/format";
import {
  OBJECTIVE_LABEL,
  SOURCE_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
  options,
} from "@/lib/labels";
import { totalsScope } from "@/lib/scope";
import { loadMoney } from "@/lib/money-server";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string; preset?: string }>;
}) {
  const { money, currency, rate } = await loadMoney();
  const { id } = await params;
  const sp = await searchParams;
  const range = resolveRange(sp);
  const prev = previousRange(range);

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      adAccount: true,
      page: true,
      product: true,
      adSets: {
        orderBy: { createdAt: "asc" },
        include: { _count: { select: { ads: true } } },
      },
    },
  });
  if (!campaign) notFound();

  const [rows, prevRows, adSetTotals] = await Promise.all([
    prisma.insight.findMany({
      where: {
        ...totalsScope,
        campaignId: id,
        date: { gte: parseDate(range.from), lte: parseDate(range.to) },
      },
      orderBy: { date: "asc" },
    }),
    prisma.insight.findMany({
      where: {
        ...totalsScope,
        campaignId: id,
        date: { gte: parseDate(prev.from), lte: parseDate(prev.to) },
      },
    }),
    prisma.insight.groupBy({
      by: ["adSetId"],
      where: {
        // ສະເພາະແຖວລະດັບຊຸດ — ບໍ່ດັ່ງນັ້ນແຖວລະດັບຊິ້ນ (ທີ່ມີ adSetId ຄືກັນ) ຈະຖືກນັບຊ້ຳ
        level: "ADSET",
        adSetId: { not: null },
        campaignId: id,
        date: { gte: parseDate(range.from), lte: parseDate(range.to) },
      },
      _sum: { spendLak: true, impressions: true, clicks: true, messages: true },
    }),
  ]);

  const total = aggregate(rows);
  const prevTotal = aggregate(prevRows);
  const adSetMap = new Map(adSetTotals.map((g) => [g.adSetId as string, g._sum]));

  const days = eachDay(range);
  const byDay = groupTotals(rows, (r) => toDateInput(r.date));
  const labels = days.map(formatDayShort);
  const spendSeries = days.map((d) => byDay.get(d)?.spendLak ?? 0);
  const revenueSeries = days.map((d) => byDay.get(d)?.revenue ?? 0);

  const create = createAdSet.bind(null, id);

  return (
    <>
      <PageHeader
        title={campaign.name}
        description={`${campaign.adAccount.name} · ${OBJECTIVE_LABEL[campaign.objective]}${
          campaign.page ? ` · ${campaign.page.name}` : ""
        }`}
        action={
          <>
            <Link href="/campaigns" className="btn">
              ← ລາຍການ
            </Link>
            <Link href={`/insights?campaign=${id}`} className="btn">
              ບັນທຶກຜົນ
            </Link>
            <Link href={`/campaigns/${id}/edit`} className="btn btn-primary">
              ແກ້ໄຂ
            </Link>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2 text-sm text-[var(--fg-muted)]">
        <Badge tone={STATUS_TONE[campaign.status]}>
          {STATUS_LABEL[campaign.status]}
        </Badge>
        {campaign.dailyBudget ? (
          <span>
            ງົບ/ວັນ {campaign.dailyBudget} {campaign.adAccount.currency}
          </span>
        ) : null}
        {campaign.product ? <span>· ສິນຄ້າ: {campaign.product.name}</span> : null}
        {campaign.ownerName ? <span>· ຜູ້ຮັບຜິດຊອບ: {campaign.ownerName}</span> : null}
        {campaign.startDate ? (
          <span>· ເລີ່ມ {formatDateLao(campaign.startDate)}</span>
        ) : null}
      </div>

      <DateRangeBar basePath={`/campaigns/${id}`} range={range} activePreset={sp.preset} />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="ຄ່າໂຄສະນາ"
          value={money(total.spendLak)}
          current={total.spendLak}
          previous={prevTotal.spendLak}
          upIsGood={false}
        />
        <StatTile
          label="ຄົນທັກແຊັດ"
          value={formatCompact(total.messages)}
          current={total.messages}
          previous={prevTotal.messages}
        />
        <StatTile
          label="ຄ່າຕໍ່ 1 ຄົນທັກ"
          value={total.messages ? money(total.costPerMessage) : "—"}
          current={total.costPerMessage}
          previous={prevTotal.costPerMessage}
          upIsGood={false}
        />
        <StatTile
          label="ROAS"
          value={total.spendLak ? `${total.roas.toFixed(2)}x` : "—"}
          current={total.roas}
          previous={prevTotal.roas}
          hint={`ຍອດຂາຍ ${money(total.revenue)}`}
        />
      </div>

      <Card className="mb-5">
        <CardHeader
          title="ຄ່າໂຄສະນາ ທຽບ ຍອດຂາຍ ລາຍວັນ"
          subtitle="ທັງສອງເສັ້ນເປັນສະກຸນກີບ ຈຶ່ງໃຊ້ແກນດຽວກັນ"
        />
        <TrendChart
          currency={currency}
          fxRate={rate}
          labels={labels}
          series={[
            { name: "ຄ່າໂຄສະນາ", color: "var(--chart-1)", values: spendSeries },
            { name: "ຍອດຂາຍ", color: "var(--chart-3)", values: revenueSeries },
          ]}
          valueFormat="lak"
        />
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid gap-5">
          <Card>
            <CardHeader
              title="ຊຸດໂຄສະນາ (Ad Sets)"
              subtitle={`${campaign.adSets.length} ຊຸດ — ຕົວເລກສະແດງສະເພາະຜົນທີ່ບັນທຶກໃນລະດັບຊຸດ`}
            />
            {campaign.adSets.length === 0 ? (
              <EmptyState
                title="ຍັງບໍ່ມີຊຸດໂຄສະນາ"
                hint="ເພີ່ມຊຸດໂຄສະນາຢູ່ຟອມທາງຂວາ ເພື່ອແຍກກຸ່ມເປົ້າໝາຍ ແລະ ງົບປະມານ"
              />
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>ຊື່ຊຸດ</th>
                      <th>ກຸ່ມເປົ້າໝາຍ</th>
                      <th>ສະຖານະ</th>
                      <th className="num">ໂຄສະນາ</th>
                      <th className="num">ຄ່າໂຄສະນາ</th>
                      <th className="num">ທັກແຊັດ</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {campaign.adSets.map((s) => {
                      const sum = adSetMap.get(s.id);
                      return (
                        <tr key={s.id}>
                          <td className="font-medium">
                            <Link href={`/ad-sets/${s.id}`} className="link">
                              {s.name}
                            </Link>
                          </td>
                          <td className="max-w-56 truncate text-xs text-[var(--fg-muted)]">
                            {s.audience ?? "—"}
                          </td>
                          <td>
                            <Badge tone={STATUS_TONE[s.status]}>
                              {STATUS_LABEL[s.status]}
                            </Badge>
                          </td>
                          <td className="num">{s._count.ads}</td>
                          <td className="num">{money(sum?.spendLak ?? 0)}</td>
                          <td className="num">{formatCompact(sum?.messages ?? 0)}</td>
                          <td className="num">
                            <Link href={`/ad-sets/${s.id}`} className="btn btn-sm">
                              ເປີດ
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

          <Card>
            <CardHeader
              title="ຜົນລາຍວັນທີ່ບັນທຶກໄວ້"
              subtitle={`${rows.length} ແຖວ ໃນຊ່ວງທີ່ເລືອກ`}
              action={
                <Link href={`/insights?campaign=${id}`} className="btn btn-sm">
                  ໄປໜ້າບັນທຶກ
                </Link>
              }
            />
            {rows.length === 0 ? (
              <EmptyState
                title="ຍັງບໍ່ມີການບັນທຶກຜົນ"
                hint="ໄປໜ້າ “ບັນທຶກຜົນລາຍວັນ” ເພື່ອປ້ອນຄ່າໂຄສະນາ ແລະ ຜົນທີ່ໄດ້"
              />
            ) : (
              <div className="table-wrap max-h-[28rem] overflow-y-auto">
                <table className="data">
                  <thead>
                    <tr>
                      <th>ວັນທີ່</th>
                      <th className="num">ຄ່າໂຄສະນາ</th>
                      <th className="num">ເຫັນ</th>
                      <th className="num">ຄລິກ</th>
                      <th className="num">CTR</th>
                      <th className="num">ທັກ</th>
                      <th className="num">ອໍເດີ</th>
                      <th className="num">ຍອດຂາຍ</th>
                      <th>ທີ່ມາ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...rows].reverse().map((r) => (
                      <tr key={r.id}>
                        <td>{formatDateLao(r.date)}</td>
                        <td className="num">{money(r.spendLak)}</td>
                        <td className="num">{formatCompact(r.impressions)}</td>
                        <td className="num">{formatCompact(r.clicks)}</td>
                        <td className="num">
                          {formatPercent(r.impressions ? r.clicks / r.impressions : 0)}
                        </td>
                        <td className="num">{r.messages}</td>
                        <td className="num">{r.purchases}</td>
                        <td className="num">{money(r.revenue)}</td>
                        <td className="text-xs text-[var(--fg-muted)]">
                          {SOURCE_LABEL[r.source]}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader title="ເພີ່ມຊຸດໂຄສະນາ" />
          <form action={create} className="grid gap-4 p-4">
            <Field label="ຊື່ຊຸດໂຄສະນາ *">
              <input name="name" required className="field" placeholder="ກຸ່ມກວ້າງ 25-45" />
            </Field>
            <Field label="ກຸ່ມເປົ້າໝາຍ" hint="ອາຍຸ / ເພດ / ພື້ນທີ່ / ຄວາມສົນໃຈ">
              <textarea name="audience" rows={2} className="field" />
            </Field>
            <Field label="ຕຳແໜ່ງສະແດງ (placements)">
              <input
                name="placements"
                className="field"
                placeholder="Facebook Feed, Reels, Messenger"
              />
            </Field>
            <Field label="ງົບຕໍ່ວັນ">
              <input
                name="dailyBudget"
                type="number"
                step="0.01"
                min="0"
                className="field"
              />
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
            <SubmitButton>ເພີ່ມຊຸດໂຄສະນາ</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
