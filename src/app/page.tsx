import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { StatTile } from "@/components/StatTile";
import { DateRangeBar } from "@/components/DateRangeBar";
import { TrendChart } from "@/components/charts/TrendChart";
import { BarList, type BarRow } from "@/components/charts/BarList";
import {
  eachDay,
  formatDateLao,
  formatDayShort,
  parseDate,
  previousRange,
  resolveRange,
  toDateInput,
} from "@/lib/date";
import { aggregate, derive, groupTotals } from "@/lib/metrics";
import { formatCompact, formatLak, formatPercent } from "@/lib/format";
import { LEAD_STATUS_LABEL, LEAD_STATUS_TONE } from "@/lib/labels";
import { totalsScope } from "@/lib/scope";
import { AlertList } from "@/components/AlertList";
import { buildAlerts, countActionable } from "@/lib/alerts";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; preset?: string }>;
}) {
  const sp = await searchParams;
  const range = resolveRange(sp);
  const prev = previousRange(range);

  const [rows, prevRows, campaigns, recentLeads, counts, alerts] = await Promise.all([
    prisma.insight.findMany({
      where: {
        ...totalsScope,
        date: { gte: parseDate(range.from), lte: parseDate(range.to) },
      },
      select: {
        date: true,
        campaignId: true,
        spendLak: true,
        impressions: true,
        reach: true,
        clicks: true,
        linkClicks: true,
        messages: true,
        leadsCount: true,
        purchases: true,
        revenue: true,
        videoViews: true,
      },
      orderBy: { date: "asc" },
    }),
    prisma.insight.findMany({
      where: {
        ...totalsScope,
        date: { gte: parseDate(prev.from), lte: parseDate(prev.to) },
      },
      select: {
        spendLak: true,
        impressions: true,
        reach: true,
        clicks: true,
        linkClicks: true,
        messages: true,
        leadsCount: true,
        purchases: true,
        revenue: true,
        videoViews: true,
      },
    }),
    prisma.campaign.findMany({ select: { id: true, name: true } }),
    prisma.lead.findMany({
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 8,
      include: { campaign: { select: { name: true } } },
    }),
    prisma.$transaction([
      prisma.campaign.count({ where: { status: "ACTIVE" } }),
      prisma.lead.count({ where: { status: "NEW" } }),
    ]),
    buildAlerts(),
  ]);

  const total = aggregate(rows);
  const prevTotal = aggregate(prevRows);
  const [activeCampaigns, newLeads] = counts;

  // ---- ຂໍ້ມູນລາຍວັນສຳລັບກຣາຟ
  const days = eachDay(range);
  const byDay = groupTotals(rows, (r) => toDateInput(r.date));
  const labels = days.map(formatDayShort);
  const spendSeries = days.map((d) => byDay.get(d)?.spendLak ?? 0);
  const revenueSeries = days.map((d) => byDay.get(d)?.revenue ?? 0);
  const messageSeries = days.map((d) => byDay.get(d)?.messages ?? 0);

  // ---- ຈັດອັນດັບແຄມເປນ
  const campaignName = new Map(campaigns.map((c) => [c.id, c.name]));
  const byCampaign = groupTotals(
    rows.filter((r) => r.campaignId),
    (r) => r.campaignId as string,
  );
  const ranked = [...byCampaign.entries()]
    .map(([id, t]) => ({ id, name: campaignName.get(id) ?? "—", ...derive(t) }))
    .sort((a, b) => b.spendLak - a.spendLak);

  const topSpend: BarRow[] = ranked.slice(0, 7).map((c) => ({
    key: c.id,
    label: c.name,
    href: `/campaigns/${c.id}`,
    value: c.spendLak,
    display: formatLak(c.spendLak),
    sub: c.spendLak ? `ROAS ${c.roas.toFixed(2)}x` : undefined,
  }));

  // ແຄມເປນທີ່ໃຊ້ເງິນແລ້ວແຕ່ຍັງບໍ່ຄຸ້ມ — ຈັດຕາມເງິນທີ່ຂາດທຶນຫຼາຍສຸດ
  const needsAttention = ranked
    .filter((c) => c.spendLak > 0 && c.roas < 1)
    .sort((a, b) => a.profit - b.profit)
    .slice(0, 5);

  return (
    <>
      <PageHeader
        title="ພາບລວມການຍິງໂຄສະນາ"
        description={`${activeCampaigns} ແຄມເປນກຳລັງຍິງ · ລູກຄ້າໃໝ່ທີ່ຍັງບໍ່ໄດ້ຕິດຕໍ່ ${newLeads} ຄົນ`}
        action={
          <>
            <Link href="/insights" className="btn">
              ບັນທຶກຜົນລາຍວັນ
            </Link>
            <Link href="/campaigns/new" className="btn btn-primary">
              + ສ້າງແຄມເປນ
            </Link>
          </>
        }
      />

      {alerts.length > 0 ? (
        <Card className="mb-5">
          <CardHeader
            title="ຕ້ອງລົງມື"
            subtitle={`${countActionable(alerts)} ເລື່ອງດ່ວນ ຈາກທັງໝົດ ${alerts.length} ການແຈ້ງເຕືອນ`}
            action={
              <Link href="/alerts" className="btn btn-sm">
                ເບິ່ງທັງໝົດ
              </Link>
            }
          />
          <AlertList alerts={alerts.slice(0, 4)} />
        </Card>
      ) : null}

      <DateRangeBar basePath="/" range={range} activePreset={sp.preset} />

      {/* ຕົວເລກນຳຂອງໜ້າ — ກຳໄລສຸດທິຂອງຊ່ວງ */}
      <Card className="mb-5 flex flex-wrap items-end justify-between gap-6 p-5">
        <div>
          <p className="text-sm text-[var(--fg-muted)]">
            ກຳໄລສຸດທິ (ຍອດຂາຍ − ຄ່າໂຄສະນາ)
          </p>
          <p
            className={`mt-1 text-5xl font-semibold leading-none ${
              total.profit >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"
            }`}
          >
            {formatLak(total.profit)}
          </p>
          <p className="mt-2 text-sm text-[var(--fg-muted)]">
            {formatDateLao(range.from)} — {formatDateLao(range.to)}
          </p>
        </div>
        <dl className="flex flex-wrap gap-x-8 gap-y-3">
          <div>
            <dt className="text-xs text-[var(--fg-muted)]">ROAS</dt>
            <dd className="text-xl font-semibold">
              {total.spendLak ? `${total.roas.toFixed(2)}x` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--fg-muted)]">ຄ່າໂຄສະນາ</dt>
            <dd className="text-xl font-semibold">{formatLak(total.spendLak)}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--fg-muted)]">ຍອດຂາຍ</dt>
            <dd className="text-xl font-semibold">{formatLak(total.revenue)}</dd>
          </div>
        </dl>
      </Card>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="ຄ່າໂຄສະນາ"
          value={formatLak(total.spendLak)}
          current={total.spendLak}
          previous={prevTotal.spendLak}
          upIsGood={false}
          spark={spendSeries}
        />
        <StatTile
          label="ຄົນທັກແຊັດ"
          value={formatCompact(total.messages)}
          current={total.messages}
          previous={prevTotal.messages}
          spark={messageSeries}
        />
        <StatTile
          label="ຄ່າຕໍ່ 1 ຄົນທັກ"
          value={total.messages ? formatLak(total.costPerMessage) : "—"}
          current={total.costPerMessage}
          previous={prevTotal.costPerMessage}
          upIsGood={false}
        />
        <StatTile
          label="ອໍເດີ"
          value={formatCompact(total.purchases)}
          current={total.purchases}
          previous={prevTotal.purchases}
          spark={days.map((d) => byDay.get(d)?.purchases ?? 0)}
        />
        <StatTile
          label="ຄ່າຕໍ່ 1 ອໍເດີ"
          value={total.purchases ? formatLak(total.costPerPurchase) : "—"}
          current={total.costPerPurchase}
          previous={prevTotal.costPerPurchase}
          upIsGood={false}
        />
        <StatTile
          label="ຄັ້ງທີ່ເຫັນ"
          value={formatCompact(total.impressions)}
          current={total.impressions}
          previous={prevTotal.impressions}
        />
        <StatTile
          label="CTR"
          value={formatPercent(total.ctr)}
          current={total.ctr}
          previous={prevTotal.ctr}
        />
        <StatTile
          label="ອັດຕາປິດ (ອໍເດີ ÷ ທັກ)"
          value={formatPercent(total.convRate, 1)}
          current={total.convRate}
          previous={prevTotal.convRate}
        />
      </div>

      <Card className="mb-5">
        <CardHeader
          title="ຄ່າໂຄສະນາ ທຽບ ຍອດຂາຍ ລາຍວັນ"
          subtitle="ທັງສອງເສັ້ນເປັນສະກຸນກີບ ຈຶ່ງໃຊ້ແກນດຽວກັນ"
        />
        <TrendChart
          labels={labels}
          series={[
            { name: "ຄ່າໂຄສະນາ", color: "var(--chart-1)", values: spendSeries },
            { name: "ຍອດຂາຍ", color: "var(--chart-3)", values: revenueSeries },
          ]}
          valueFormat="lak"
        />
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="ແຄມເປນທີ່ໃຊ້ເງິນຫຼາຍສຸດ"
            subtitle="ຈັດອັນດັບຕາມຄ່າໂຄສະນາໃນຊ່ວງທີ່ເລືອກ"
            action={
              <Link href="/campaigns" className="btn btn-sm">
                ເບິ່ງທັງໝົດ
              </Link>
            }
          />
          <BarList rows={topSpend} emptyText="ຍັງບໍ່ມີການບັນທຶກຄ່າໂຄສະນາໃນຊ່ວງນີ້" />
        </Card>

        <Card>
          <CardHeader
            title="ຕ້ອງເບິ່ງດ່ວນ — ROAS ຕ່ຳກວ່າ 1"
            subtitle="ໃຊ້ເງິນໄປແລ້ວ ແຕ່ຍອດຂາຍຍັງບໍ່ຄຸ້ມຄ່າໂຄສະນາ"
          />
          {needsAttention.length === 0 ? (
            <EmptyState
              title="ບໍ່ມີແຄມເປນທີ່ຂາດທຶນ"
              hint="ທຸກແຄມເປນທີ່ໃຊ້ເງິນ ມີ ROAS ຕັ້ງແຕ່ 1 ຂຶ້ນໄປ"
            />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>ແຄມເປນ</th>
                    <th className="num">ຄ່າໂຄສະນາ</th>
                    <th className="num">ຍອດຂາຍ</th>
                    <th className="num">ຂາດທຶນ</th>
                    <th className="num">ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {needsAttention.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/campaigns/${c.id}`} className="link">
                          {c.name}
                        </Link>
                      </td>
                      <td className="num">{formatLak(c.spendLak)}</td>
                      <td className="num">{formatLak(c.revenue)}</td>
                      <td className="num text-[var(--danger)]">
                        {formatLak(c.profit)}
                      </td>
                      <td className="num">{c.roas.toFixed(2)}x</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader
            title="ລູກຄ້າຫຼ້າສຸດ"
            action={
              <Link href="/leads" className="btn btn-sm">
                ເບິ່ງທັງໝົດ
              </Link>
            }
          />
          {recentLeads.length === 0 ? (
            <EmptyState title="ຍັງບໍ່ມີລູກຄ້າ" />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>ວັນທີ່</th>
                    <th>ຊື່</th>
                    <th>ເບີໂທ</th>
                    <th>ແຄມເປນ</th>
                    <th className="num">ຍອດຊື້</th>
                    <th>ສະຖານະ</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLeads.map((lead) => (
                    <tr key={lead.id}>
                      <td className="whitespace-nowrap">{formatDateLao(lead.date)}</td>
                      <td className="font-medium">{lead.name}</td>
                      <td className="tnum">{lead.phone ?? "—"}</td>
                      <td className="max-w-56 truncate text-xs">
                        {lead.campaign?.name ?? "—"}
                      </td>
                      <td className="num">
                        {lead.amount ? formatLak(lead.amount) : "—"}
                      </td>
                      <td>
                        <Badge tone={LEAD_STATUS_TONE[lead.status]}>
                          {LEAD_STATUS_LABEL[lead.status]}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
