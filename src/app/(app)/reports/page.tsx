import Link from "next/link";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { DateRangeBar } from "@/components/DateRangeBar";
import { resolveRange } from "@/lib/date";
import { buildReport, GROUP_BYS, type GroupBy } from "@/lib/report";
import { formatCompact, formatPercent } from "@/lib/format";
import { loadMoney } from "@/lib/money-server";

export const dynamic = "force-dynamic";

type Search = { from?: string; to?: string; preset?: string; by?: string };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { money } = await loadMoney();
  const sp = await searchParams;
  const range = resolveRange(sp);
  const groupBy = (
    sp.by && sp.by in GROUP_BYS ? sp.by : "campaign"
  ) as GroupBy;

  const { rows, totals } = await buildReport(range, groupBy);

  const exportHref = `/api/reports/export?from=${range.from}&to=${range.to}&by=${groupBy}`;

  return (
    <>
      <PageHeader
        title="ລາຍງານ"
        description="ສະຫຼຸບຜົນການຍິງຕາມມິຕິຕ່າງໆ — ຄ່າໃຊ້ຈ່າຍ ແລະ ຍອດຂາຍເປັນສະກຸນກີບທັງໝົດ"
        action={
          <a href={exportHref} className="btn">
            ⤓ ດາວໂຫຼດ CSV
          </a>
        }
      />

      <DateRangeBar
        basePath="/reports"
        range={range}
        activePreset={sp.preset}
        keep={{ by: groupBy }}
      />

      <div className="mb-5 flex flex-wrap gap-1.5">
        {(Object.keys(GROUP_BYS) as GroupBy[]).map((key) => (
          <Link
            key={key}
            href={`/reports?from=${range.from}&to=${range.to}&by=${key}`}
            className={`btn btn-sm ${groupBy === key ? "btn-primary" : ""}`}
          >
            {GROUP_BYS[key]}
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader
          title={GROUP_BYS[groupBy]}
          subtitle={`${rows.length} ແຖວ · ຕົວຊີ້ວັດຄິດຈາກຍອດລວມຂອງແຕ່ລະກຸ່ມ`}
        />
        {rows.length === 0 ? (
          <EmptyState
            title="ບໍ່ມີຂໍ້ມູນໃນຊ່ວງນີ້"
            hint="ລອງຂະຫຍາຍຊ່ວງວັນ ຫຼື ໄປບັນທຶກຜົນລາຍວັນກ່ອນ"
            action={
              <Link href="/insights" className="btn btn-primary">
                ໄປໜ້າບັນທຶກຜົນ
              </Link>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>{GROUP_BYS[groupBy].replace("ຕາມ", "")}</th>
                  <th className="num">ຄ່າໂຄສະນາ</th>
                  <th className="num">ເຫັນ</th>
                  <th className="num">ເຂົ້າເຖິງ</th>
                  <th className="num">ຄລິກ</th>
                  <th className="num">CTR</th>
                  <th className="num">CPC</th>
                  <th className="num">CPM</th>
                  <th className="num">ທັກແຊັດ</th>
                  <th className="num">ຄ່າ/ທັກ</th>
                  <th className="num">ອໍເດີ</th>
                  <th className="num">ຄ່າ/ອໍເດີ</th>
                  <th className="num">ຍອດຂາຍ</th>
                  <th className="num">ກຳໄລ</th>
                  <th className="num">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td className="max-w-64 truncate font-medium">
                      {r.href ? (
                        <Link href={r.href} className="link">
                          {r.label}
                        </Link>
                      ) : (
                        r.label
                      )}
                    </td>
                    <td className="num">{money(r.spendLak)}</td>
                    <td className="num">{formatCompact(r.impressions)}</td>
                    <td className="num">{formatCompact(r.reach)}</td>
                    <td className="num">{formatCompact(r.clicks)}</td>
                    <td className="num">{formatPercent(r.ctr)}</td>
                    <td className="num">{r.clicks ? money(r.cpc) : "—"}</td>
                    <td className="num">
                      {r.impressions ? money(r.cpm) : "—"}
                    </td>
                    <td className="num">{formatCompact(r.messages)}</td>
                    <td className="num">
                      {r.messages ? money(r.costPerMessage) : "—"}
                    </td>
                    <td className="num">{formatCompact(r.purchases)}</td>
                    <td className="num">
                      {r.purchases ? money(r.costPerPurchase) : "—"}
                    </td>
                    <td className="num">{money(r.revenue)}</td>
                    <td
                      className={`num ${
                        r.profit >= 0
                          ? "text-[var(--success)]"
                          : "text-[var(--danger)]"
                      }`}
                    >
                      {money(r.profit)}
                    </td>
                    <td className="num">
                      {r.spendLak ? `${r.roas.toFixed(2)}x` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td className="border-t-2 border-[var(--border-strong)]">ລວມ</td>
                  <td className="num border-t-2 border-[var(--border-strong)]">
                    {money(totals.spendLak)}
                  </td>
                  <td className="num border-t-2 border-[var(--border-strong)]">
                    {formatCompact(totals.impressions)}
                  </td>
                  <td className="num border-t-2 border-[var(--border-strong)]">
                    {formatCompact(totals.reach)}
                  </td>
                  <td className="num border-t-2 border-[var(--border-strong)]">
                    {formatCompact(totals.clicks)}
                  </td>
                  <td className="num border-t-2 border-[var(--border-strong)]">
                    {formatPercent(totals.ctr)}
                  </td>
                  <td className="num border-t-2 border-[var(--border-strong)]">
                    {totals.clicks ? money(totals.cpc) : "—"}
                  </td>
                  <td className="num border-t-2 border-[var(--border-strong)]">
                    {totals.impressions ? money(totals.cpm) : "—"}
                  </td>
                  <td className="num border-t-2 border-[var(--border-strong)]">
                    {formatCompact(totals.messages)}
                  </td>
                  <td className="num border-t-2 border-[var(--border-strong)]">
                    {totals.messages ? money(totals.costPerMessage) : "—"}
                  </td>
                  <td className="num border-t-2 border-[var(--border-strong)]">
                    {formatCompact(totals.purchases)}
                  </td>
                  <td className="num border-t-2 border-[var(--border-strong)]">
                    {totals.purchases ? money(totals.costPerPurchase) : "—"}
                  </td>
                  <td className="num border-t-2 border-[var(--border-strong)]">
                    {money(totals.revenue)}
                  </td>
                  <td
                    className={`num border-t-2 border-[var(--border-strong)] ${
                      totals.profit >= 0
                        ? "text-[var(--success)]"
                        : "text-[var(--danger)]"
                    }`}
                  >
                    {money(totals.profit)}
                  </td>
                  <td className="num border-t-2 border-[var(--border-strong)]">
                    {totals.spendLak ? `${totals.roas.toFixed(2)}x` : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
