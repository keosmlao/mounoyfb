import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { DateRangeBar } from "@/components/DateRangeBar";
import { RunToggle } from "@/components/RunToggle";
import { toggleCampaignStatusSafe } from "./actions";
import { parseDate, resolveRange } from "@/lib/date";
import { derive, EMPTY_TOTALS, type Totals } from "@/lib/metrics";
import { formatCompact, formatPercent } from "@/lib/format";
import {
  OBJECTIVE_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
  options,
} from "@/lib/labels";
import type { EntityStatus } from "@/generated/prisma/enums";
import { totalsScope } from "@/lib/scope";
import { loadMoney } from "@/lib/money-server";
import { deriveOrderEconomics, groupOrderTotals } from "@/lib/orders";

export const dynamic = "force-dynamic";

type Search = {
  from?: string;
  to?: string;
  preset?: string;
  account?: string;
  status?: string;
  q?: string;
};

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { money } = await loadMoney();
  const sp = await searchParams;
  const range = resolveRange(sp);

  // ຄ່າຕັ້ງຕົ້ນເຊື່ອງອັນທີ່ເກັບເຂົ້າຄັງ — ສ່ວນຫຼາຍແມ່ນອັນທີ່ຖືກລຶບຢູ່ Facebook ແລ້ວ
  // (ຍັງເກັບຂໍ້ມູນໄວ້ ເພື່ອບໍ່ໃຫ້ຄ່າໂຄສະນາໃນອະດີດຫາຍຈາກລາຍງານ).
  // ເລືອກສະຖານະ "ເກັບເຂົ້າຄັງ" ໃນຕົວກັ່ນຕອງ ຈຶ່ງເຫັນຄືນ.
  const where = {
    ...(sp.account ? { adAccountId: sp.account } : {}),
    ...(sp.status
      ? { status: sp.status as EntityStatus }
      : { status: { not: "ARCHIVED" as EntityStatus } }),
    ...(sp.q ? { name: { contains: sp.q, mode: "insensitive" as const } } : {}),
  };

  const [campaigns, accounts, grouped, orderRows, archivedCount] = await Promise.all([
    prisma.campaign.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        adAccount: { select: { name: true, currency: true } },
        page: { select: { name: true } },
        product: { select: { name: true } },
        _count: { select: { adSets: true } },
      },
    }),
    prisma.adAccount.findMany({ orderBy: { name: "asc" } }),
    prisma.insight.groupBy({
      by: ["campaignId"],
      where: {
        ...totalsScope,
        campaignId: { not: null },
        date: { gte: parseDate(range.from), lte: parseDate(range.to) },
      },
      _sum: {
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
    prisma.order.findMany({
      where: {
        campaignId: { not: null },
        date: { gte: parseDate(range.from), lte: parseDate(range.to) },
      },
      select: {
        campaignId: true,
        status: true,
        saleAmount: true,
        productCost: true,
        shippingCost: true,
        otherCost: true,
        refundAmount: true,
      },
    }),
    prisma.campaign.count({
      where: {
        status: "ARCHIVED",
        ...(sp.account ? { adAccountId: sp.account } : {}),
      },
    }),
  ]);

  const totalsByCampaign = new Map<string, Totals>(
    grouped.map((g) => [
      g.campaignId as string,
      {
        spendLak: g._sum.spendLak ?? 0,
        impressions: g._sum.impressions ?? 0,
        reach: g._sum.reach ?? 0,
        clicks: g._sum.clicks ?? 0,
        linkClicks: g._sum.linkClicks ?? 0,
        messages: g._sum.messages ?? 0,
        leadsCount: g._sum.leadsCount ?? 0,
        purchases: g._sum.purchases ?? 0,
        revenue: g._sum.revenue ?? 0,
        videoViews: g._sum.videoViews ?? 0,
      },
    ]),
  );
  const ordersByCampaign = groupOrderTotals(
    orderRows,
    (row) => row.campaignId as string,
  );

  return (
    <>
      <PageHeader
        title="ແຄມເປນ"
        description="ຜົນການຍິງຕາມຊ່ວງວັນທີ່ເລືອກ — ຄ່າໃຊ້ຈ່າຍທັງໝົດແປງເປັນກີບແລ້ວ"
        action={
          <Link href="/campaigns/new" className="btn btn-primary">
            + ສ້າງແຄມເປນ
          </Link>
        }
      />

      <DateRangeBar
        basePath="/campaigns"
        range={range}
        activePreset={sp.preset}
        keep={{ account: sp.account, status: sp.status, q: sp.q }}
      />

      <Card className="mb-5">
        <form
          method="get"
          action="/campaigns"
          className="flex flex-wrap items-end gap-3 p-3"
        >
          <input type="hidden" name="from" value={range.from} />
          <input type="hidden" name="to" value={range.to} />
          <div>
            <label className="label">ຄົ້ນຫາຊື່</label>
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              className="field"
              placeholder="ພິມຊື່ແຄມເປນ"
            />
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
          <div>
            <label className="label">ສະຖານະ</label>
            <select name="status" defaultValue={sp.status ?? ""} className="field">
              <option value="">ທີ່ຍັງໃຊ້ຢູ່ (ບໍ່ລວມຄັງ)</option>
              {options(STATUS_LABEL).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn">
            ກັ່ນຕອງ
          </button>
          {sp.q || sp.account || sp.status ? (
            <Link href="/campaigns" className="btn btn-sm">
              ລ້າງ
            </Link>
          ) : null}
        </form>
      </Card>

      <Card>
        <CardHeader
          title="ລາຍການແຄມເປນ"
          subtitle={
            <>
              ພົບ {campaigns.length} ແຄມເປນ
              {!sp.status && archivedCount > 0 ? (
                <>
                  {" · ເຊື່ອງ "}
                  {archivedCount} ອັນທີ່ເກັບເຂົ້າຄັງ (ຖືກລຶບ/ຢຸດຢູ່ Facebook){" "}
                  <Link
                    href={`/campaigns?status=ARCHIVED${sp.account ? `&account=${sp.account}` : ""}`}
                    className="link"
                  >
                    ເບິ່ງ
                  </Link>
                </>
              ) : null}
            </>
          }
        />
        {campaigns.length === 0 ? (
          <EmptyState
            title="ບໍ່ພົບແຄມເປນ"
            hint="ລອງລ້າງຕົວກັ່ນຕອງ ຫຼື ສ້າງແຄມເປນໃໝ່"
            action={
              <Link href="/campaigns/new" className="btn btn-primary">
                + ສ້າງແຄມເປນ
              </Link>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>ແຄມເປນ</th>
                  <th>ເປົ້າໝາຍ</th>
                  <th>ສະຖານະ</th>
                  <th className="num">ຄ່າໂຄສະນາ</th>
                  <th className="num">ເຫັນ</th>
                  <th className="num">ຄລິກ</th>
                  <th className="num">CTR</th>
                  <th className="num">ທັກແຊັດ</th>
                  <th className="num">ຄ່າ/ທັກ</th>
                  <th className="num">Meta Purchase</th>
                  <th className="num">ສົ່ງສຳເລັດ</th>
                  <th className="num">ຍອດຂາຍຈິງ</th>
                  <th className="num">Actual ROAS</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  const d = derive(totalsByCampaign.get(c.id) ?? EMPTY_TOTALS);
                  const actual = ordersByCampaign.get(c.id);
                  const economics = actual
                    ? deriveOrderEconomics(actual, d.spendLak)
                    : null;
                  // ຢຸດ/ຍິງຕໍ່ ໄດ້ສະເພາະ 2 ສະຖານະນີ້ — ອັນອື່ນ (ຮ່າງ/ຈົບ/ຄັງ) ບໍ່ມີຄວາມໝາຍ
                  const runnable =
                    c.status === "ACTIVE" || c.status === "PAUSED";
                  const toggle = toggleCampaignStatusSafe.bind(
                    null,
                    c.id,
                    c.status === "ACTIVE" ? "PAUSED" : "ACTIVE",
                  );
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/campaigns/${c.id}`} className="link font-medium">
                          {c.name}
                        </Link>
                        <div className="mt-0.5 text-xs text-[var(--fg-subtle)]">
                          {c.adAccount.name}
                          {c.product ? ` · ${c.product.name}` : ""}
                          {` · ${c._count.adSets} ຊຸດ`}
                        </div>
                      </td>
                      <td className="text-xs">{OBJECTIVE_LABEL[c.objective]}</td>
                      <td>
                        <Badge tone={STATUS_TONE[c.status]}>
                          {STATUS_LABEL[c.status]}
                        </Badge>
                      </td>
                      <td className="num">{money(d.spendLak)}</td>
                      <td className="num">{formatCompact(d.impressions)}</td>
                      <td className="num">{formatCompact(d.clicks)}</td>
                      <td className="num">{formatPercent(d.ctr)}</td>
                      <td className="num">{formatCompact(d.messages)}</td>
                      <td className="num">
                        {d.messages ? money(d.costPerMessage) : "—"}
                      </td>
                      <td className="num">{formatCompact(d.purchases)}</td>
                      <td className="num">
                        {economics ? formatCompact(economics.delivered) : "—"}
                      </td>
                      <td className="num">
                        {economics ? money(economics.netRevenue) : "—"}
                      </td>
                      <td className="num">
                        <span
                          className={
                            economics && economics.contributionProfit >= 0
                              ? "text-[var(--success)]"
                              : economics
                                ? "text-[var(--danger)]"
                                : ""
                          }
                        >
                          {economics && d.spendLak
                            ? `${economics.actualRoas.toFixed(2)}x`
                            : "—"}
                        </span>
                      </td>
                      <td className="num">
                        {runnable ? (
                          <RunToggle
                            action={toggle}
                            label={c.status === "ACTIVE" ? "ຢຸດ" : "ຍິງຕໍ່"}
                          />
                        ) : null}
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
