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
import { formatCompact } from "@/lib/format";
import { LEAD_STATUS_LABEL, LEAD_STATUS_TONE } from "@/lib/labels";
import { totalsScope } from "@/lib/scope";
import { AlertList } from "@/components/AlertList";
import { buildAlerts, countActionable } from "@/lib/alerts";
import { AdviceList } from "@/components/AdviceList";
import { actionable, buildAdvice, waiting } from "@/lib/advice";
import { loadMoney } from "@/lib/money-server";
import { orderEconomics } from "@/lib/advice-rules";
import { sumOrderTotals, type OrderFinancialRow } from "@/lib/orders";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; preset?: string }>;
}) {
  const { money, currency, rate } = await loadMoney();
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

  // ຍອດຂາຍຈິງມາຈາກ Order ບໍ່ແມ່ນ Insight.revenue —
  // Facebook ບໍ່ຮູ້ຍອດຂາຍຂອງແຄມເປນທີ່ປິດການຂາຍຜ່ານແຊັດ
  const [econ, orderRows] = await Promise.all([
    orderEconomics(range),
    prisma.order.findMany({
      where: { date: { gte: parseDate(range.from), lte: parseDate(range.to) } },
      select: {
        date: true,
        status: true,
        saleAmount: true,
        productCost: true,
        shippingCost: true,
        otherCost: true,
        refundAmount: true,
      },
    }),
  ]);

  const total = aggregate(rows);
  const prevTotal = aggregate(prevRows);
  const orderTotals = sumOrderTotals(orderRows as OrderFinancialRow[]);

  /** ກຳໄລ ແລະ ROAS ທີ່ເຊື່ອຖືໄດ້ — ໃຊ້ອໍເດີກ່ອນສະເໝີ ຖ້າມີ */
  const realRevenue = orderTotals.netRevenue || total.revenue;
  const realProfit = econ
    ? econ.contributionProfit
    : realRevenue - total.spendLak;
  const realRoas = total.spendLak > 0 ? realRevenue / total.spendLak : 0;
  const advice = await buildAdvice(range);
  const topAdvice = actionable(advice).slice(0, 4);
  const blocked = waiting(advice).slice(0, 2);
  const [activeCampaigns, newLeads] = counts;

  // ---- ຂໍ້ມູນລາຍວັນສຳລັບກຣາຟ
  const days = eachDay(range);
  const byDay = groupTotals(rows, (r) => toDateInput(r.date));
  const labels = days.map(formatDayShort);
  const spendSeries = days.map((d) => byDay.get(d)?.spendLak ?? 0);
  const orderRevenueByDay = new Map<string, number>();
  for (const o of orderRows) {
    if (o.status === "CANCELLED" || o.status === "RETURNED") continue;
    const k = toDateInput(o.date);
    orderRevenueByDay.set(
      k,
      (orderRevenueByDay.get(k) ?? 0) + o.saleAmount - o.refundAmount,
    );
  }
  const revenueSeries = days.map(
    (d) => orderRevenueByDay.get(d) ?? byDay.get(d)?.revenue ?? 0,
  );
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
    display: money(c.spendLak),
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
            <Link href="/campaigns/new" className="btn btn-primary">
              + ສ້າງແຄມເປນ
            </Link>
          </>
        }
      />

      <DateRangeBar basePath="/" range={range} activePreset={sp.preset} />

      {/* ຕົວເລກນຳ — ກຳໄລຈິງຈາກອໍເດີ ບໍ່ແມ່ນຈາກ pixel ຂອງ Facebook */}
      <Card className="mb-5 flex flex-wrap items-end justify-between gap-6 p-5">
        <div>
          <p className="text-sm text-[var(--fg-muted)]">
            ກຳໄລສຸດທິ
            <span className="ml-1 text-xs text-[var(--fg-subtle)]">
              {econ ? "(ຍອດຂາຍ − ຕົ້ນທຶນ − ຄ່າສົ່ງ − ຄ່າໂຄສະນາ)" : "(ຍອດຂາຍ − ຄ່າໂຄສະນາ)"}
            </span>
          </p>
          <p
            className={`mt-1 text-5xl font-semibold leading-none ${
              realProfit >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"
            }`}
          >
            {money(realProfit)}
          </p>
          <p className="mt-2 text-sm text-[var(--fg-muted)]">
            {formatDateLao(range.from)} — {formatDateLao(range.to)}
          </p>
        </div>

        <dl className="flex flex-wrap gap-x-8 gap-y-3">
          <div>
            <dt className="text-xs text-[var(--fg-muted)]">ROAS</dt>
            <dd className="text-xl font-semibold">
              {total.spendLak ? `${realRoas.toFixed(2)}x` : "—"}
            </dd>
            {econ ? (
              <dd className="text-[0.7rem] text-[var(--fg-subtle)]">
                ຄຸ້ມທຶນທີ່ {econ.breakEvenRoas.toFixed(2)}x
              </dd>
            ) : null}
          </div>
          <div>
            <dt className="text-xs text-[var(--fg-muted)]">ຄ່າໂຄສະນາ</dt>
            <dd className="text-xl font-semibold">{money(total.spendLak)}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--fg-muted)]">ຍອດຂາຍ</dt>
            <dd className="text-xl font-semibold">{money(realRevenue)}</dd>
            {orderTotals.delivered > 0 ? (
              <dd className="text-[0.7rem] text-[var(--fg-subtle)]">
                {formatCompact(orderTotals.delivered)} ອໍເດີສົ່ງສຳເລັດ
              </dd>
            ) : null}
          </div>
        </dl>
      </Card>

      {topAdvice.length > 0 ? (
        <Card className="mb-5">
          <CardHeader
            title="ຄວນເຮັດຫຍັງຕໍ່"
            subtitle="ຄິດຈາກຜົນແຍກກຸ່ມຂອງຊ່ວງທີ່ເລືອກ"
            action={
              <Link href="/analysis" className="btn btn-sm">
                ເບິ່ງການວິເຄາະ
              </Link>
            }
          />
          <AdviceList advice={topAdvice} />
        </Card>
      ) : null}

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

      {blocked.length > 0 ? (
        <Card className="mb-5">
          <CardHeader
            title="ຍັງຕັດສິນບໍ່ໄດ້"
            subtitle="ຂາດຂໍ້ມູນຫຍັງ ແລະ ຕ້ອງເຮັດຫຍັງຈຶ່ງຕັດສິນໄດ້"
          />
          <AdviceList advice={blocked} />
        </Card>
      ) : null}

      {/* 5 ຕົວທີ່ໃຊ້ຕັດສິນໃຈຈິງ — ຕົວອື່ນຢູ່ໜ້າ ວິເຄາະ ແລະ ລາຍງານ */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile
          label="ຄ່າໂຄສະນາ"
          value={money(total.spendLak)}
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
          value={total.messages ? money(total.costPerMessage) : "—"}
          current={total.costPerMessage}
          previous={prevTotal.costPerMessage}
          upIsGood={false}
          hint="ຕົວຊີ້ວັດຫຼັກຂອງແຄມເປນແບບທັກແຊັດ"
        />
        <StatTile
          label="ອໍເດີສົ່ງສຳເລັດ"
          value={formatCompact(orderTotals.delivered)}
          hint={
            orderTotals.returned > 0
              ? `ຕີກັບ ${formatCompact(orderTotals.returned)}`
              : "ຈາກໜ້າ ອໍເດີ"
          }
        />
        <StatTile
          label="ຄ່າໂຄສະນາຕໍ່ 1 ອໍເດີ"
          value={
            orderTotals.delivered
              ? money(total.spendLak / orderTotals.delivered)
              : "—"
          }
          upIsGood={false}
          hint={econ ? `ເພດານ ${money(econ.marginPerOrder)}` : "ຕ້ອງມີອໍເດີກ່ອນ"}
        />
      </div>

      <Card className="mb-5">
        <CardHeader
          title="ຄ່າໂຄສະນາ ທຽບ ຍອດຂາຍ ລາຍວັນ"
          subtitle="ຍອດຂາຍມາຈາກອໍເດີທີ່ບັນທຶກໄວ້ — ທັງສອງເສັ້ນໃຊ້ແກນດຽວກັນ"
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
                      <td className="num">{money(c.spendLak)}</td>
                      <td className="num">{money(c.revenue)}</td>
                      <td className="num text-[var(--danger)]">
                        {money(c.profit)}
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
                        {lead.amount ? money(lead.amount) : "—"}
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
