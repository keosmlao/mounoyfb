import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { StatStrip, StatTile } from "@/components/StatTile";
import { AdviceList } from "@/components/AdviceList";
import { BarList } from "@/components/charts/BarList";
import { TrendChart } from "@/components/charts/TrendChart";
import { loadLiveAnalysis } from "@/lib/live-server";
import { adviseLive, analyzeLive } from "@/lib/live-analysis";
import { formatDateLao } from "@/lib/date";
import { formatInt, formatPercent } from "@/lib/format";
import { loadMoney } from "@/lib/money-server";

export const dynamic = "force-dynamic";

/**
 * ວິເຄາະຮອບ live — ມີປະສິດທິພາບບໍ່ ແລະ ຮອບໜ້າຄວນປັບຫຍັງ.
 * ຕົວເລກມາຈາກ comment/CF/ບິນ ຂອງເຮົາເອງ (ບໍ່ມີຍອດຄົນເບິ່ງຂອງ Facebook).
 */
export default async function LiveReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ money, currency, rate }, loaded] = await Promise.all([loadMoney(), loadLiveAnalysis(id)]);
  if (!loaded) notFound();

  const { session, input } = loaded;
  const a = analyzeLive(input);
  const advice = adviseLive(a, money, session.autoAck);
  const hasData = a.comments > 0 || a.reservedQty > 0;

  const funnel = [
    { key: "commenters", label: "ຄົນ comment", value: a.commenters },
    { key: "cf", label: "ຄົນ CF", value: a.cfCustomers },
    { key: "billed", label: "ອອກບິນ", value: a.funnel.billed },
    { key: "notified", label: "ແຈ້ງຍອດແລ້ວ", value: a.funnel.notified },
    { key: "confirmed", label: "ຢືນຢັນ / ສົ່ງແລ້ວ", value: a.funnel.confirmed },
    { key: "delivered", label: "ຮັບສຳເລັດ", value: a.funnel.delivered },
  ];

  return (
    <>
      <PageHeader
        title={`ວິເຄາະ: ${session.title}`}
        description={`${session.page.name} · ${formatDateLao(session.date)} · ຄິດຈາກ comment, CF ແລະ ບິນຂອງລະບົບ (ບໍ່ລວມຍອດຄົນເບິ່ງຂອງ Facebook)`}
        action={<Link href={`/live/${session.id}`} className="btn">← ກະດານ live</Link>}
      />

      {!hasData ? (
        <Card>
          <EmptyState
            title="ຍັງບໍ່ມີຂໍ້ມູນໃຫ້ວິເຄາະ"
            hint="ເລີ່ມເກັບ CF ລະຫວ່າງ live — comment ທີ່ເກັບໄດ້ຈະມາເປັນຕົວເລກຢູ່ບ່ອນນີ້"
          />
        </Card>
      ) : (
        <>
          <StatStrip cols={6}>
            <StatTile
              label="ຍອດຈອງ"
              value={money(a.reservedValue)}
              hint={
                a.vsPast !== null
                  ? `${a.vsPast >= 1 ? "▲" : "▼"} ${formatPercent(Math.abs(a.vsPast - 1), 0)} ທຽບ live ກ່ອນໆ`
                  : `${formatInt(a.reservedQty)} ຊິ້ນ`
              }
            />
            <StatTile label="ຍອດຂາຍຈິງ" value={money(a.money.netRevenue)} hint={`ຮັບສຳເລັດ ${formatInt(a.funnel.delivered)} ບິນ`} />
            <StatTile label="ພາດເພາະຂອງໝົດ" value={money(a.missedValue)} hint={`ລໍຄິວ ${formatInt(a.waitlistQty)} ຊິ້ນ`} />
            <StatTile label="ຄົນ comment → CF" value={formatPercent(a.conversion, 0)} hint={`${formatInt(a.cfCustomers)} / ${formatInt(a.commenters)} ຄົນ`} />
            <StatTile label="comment / ນາທີ" value={a.commentsPerMinute.toFixed(1)} hint={`${formatInt(a.comments)} comment · ${formatInt(a.minutes)} ນາທີ`} />
            <StatTile
              label="ຕອບຄຳຖາມ"
              value={a.questions ? formatPercent(a.answerRate, 0) : "—"}
              hint={
                a.medianReplyMinutes !== null
                  ? `${formatInt(a.answered)}/${formatInt(a.questions)} · ຕອບໃນ ~${Math.round(a.medianReplyMinutes)} ນາທີ`
                  : `${formatInt(a.answered)}/${formatInt(a.questions)} ຄຳຖາມ`
              }
            />
          </StatStrip>

          <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="grid gap-3">
              <Card>
                <CardHeader title="ຮອບໜ້າຄວນປັບຫຍັງ" subtitle="ລະບົບແນະນຳສະເພາະເມື່ອຂໍ້ມູນພໍ — live ນ້ອຍໆຈະມີຄຳແນະນຳໜ້ອຍ" />
                <AdviceList
                  advice={advice}
                  emptyTitle="ບໍ່ມີຈຸດທີ່ຕ້ອງປັບ"
                  emptyHint="ຫຼື ຂໍ້ມູນຍັງບໍ່ພໍໃຫ້ລະບົບກ້າສະຫຼຸບ (ຕ້ອງມີຄົນ comment 20 ຄົນ ຫຼື CF 10 ລາຍການຂຶ້ນໄປ)"
                />
              </Card>

              <Card>
                <CardHeader
                  title="comment ແລະ CF ຕາມເວລາ"
                  subtitle={
                    a.peak
                      ? `ນັບຈາກ comment ທຳອິດ ທຸກ ${a.bucketMinutes} ນາທີ · CF ຫຼາຍສຸດຊ່ວງ ${a.peak.label} (${formatInt(a.peak.cf)} CF)`
                      : `ນັບຈາກ comment ທຳອິດ ທຸກ ${a.bucketMinutes} ນາທີ`
                  }
                />
                <div className="p-3">
                  <TrendChart
                    labels={a.timeline.map((b) => b.label)}
                    series={[
                      { name: "comment", color: "var(--chart-1)", values: a.timeline.map((b) => b.comments) },
                      { name: "CF", color: "var(--chart-3)", values: a.timeline.map((b) => b.cf) },
                    ]}
                    valueFormat="int"
                    currency={currency}
                    fxRate={rate}
                  />
                </div>
              </Card>

              <Card>
                <CardHeader title="ສິນຄ້າ" subtitle="ຂອງໝົດໄວ + ມີຄົນລໍ = ເອົາມາເພີ່ມ · ບໍ່ມີຄົນ CF = ປ່ຽນວິທີນຳສະເໜີ" />
                {a.items.length === 0 ? (
                  <EmptyState title="ບໍ່ໄດ້ຕັ້ງສິນຄ້າໃນ live ນີ້" />
                ) : (
                  <div className="table-wrap">
                    <table className="data">
                      <thead>
                        <tr>
                          <th>ສິນຄ້າ</th>
                          <th className="num">CF</th>
                          <th className="num">ຈອງ / ມີ</th>
                          <th className="num">ຂາຍໄດ້</th>
                          <th className="num">ໝົດຕອນ</th>
                          <th className="num">ລໍຄິວ</th>
                          <th className="num">ຍອດຈອງ</th>
                          <th className="num">ພາດ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {a.items
                          .toSorted((x, y) => y.reservedValue - x.reservedValue)
                          .map((item) => (
                            <tr key={item.id}>
                              <td>
                                <span className="font-semibold">{item.code}</span> {item.name}
                              </td>
                              <td className="num">{formatInt(item.cfCount)}</td>
                              <td className="num">
                                {formatInt(item.reserved)} / {item.stock === null ? "∞" : formatInt(item.stock)}
                              </td>
                              <td className="num">
                                {item.sellThrough === null ? "—" : formatPercent(item.sellThrough, 0)}
                              </td>
                              <td className="num">
                                {item.soldOutMinute === null ? "—" : `ນາທີ ${formatInt(item.soldOutMinute)}`}
                              </td>
                              <td className={`num ${item.waitlist ? "text-[var(--warning)]" : ""}`}>
                                {formatInt(item.waitlist)}
                              </td>
                              <td className="num">{money(item.reservedValue)}</td>
                              <td className="num">{item.missedValue ? money(item.missedValue) : "—"}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>

            <div className="grid gap-3">
              <Card>
                <CardHeader title="ຈາກ comment ຮອດຮັບເງິນ" subtitle="ຫຼຸດຫຼາຍຢູ່ຂັ້ນໃດ ຄືຈຸດທີ່ຕ້ອງແກ້ກ່ອນ" />
                <BarList
                  rows={funnel.map((step, i) => ({
                    key: step.key,
                    label: step.label,
                    value: step.value,
                    display: formatInt(step.value),
                    sub:
                      i > 0 && funnel[i - 1].value > 0
                        ? `${formatPercent(step.value / funnel[i - 1].value, 0)} ຂອງຂັ້ນກ່ອນ`
                        : undefined,
                  }))}
                />
                {a.funnel.cancelled ? (
                  <p className="border-t border-[var(--border)] px-4 py-2 text-xs text-[var(--danger)]">
                    ຍົກເລີກ / ຕີກັບ {formatInt(a.funnel.cancelled)} ບິນ
                  </p>
                ) : null}
              </Card>

              <Card>
                <CardHeader title="ລູກຄ້າຖາມຫຍັງ" subtitle="ຖາມຫຼາຍ = ຄວນບອກໄວ້ລ່ວງໜ້າໃນ live ຮອບໜ້າ" />
                <BarList
                  rows={a.intents.map((i) => ({
                    key: i.key,
                    label: i.label,
                    value: i.count,
                    display: `${formatInt(i.count)} ເທື່ອ`,
                  }))}
                  emptyText="ບໍ່ມີຄຳຖາມທີ່ຈັດໝວດໄດ້"
                />
              </Card>

              <Card>
                <CardHeader title="ຄຸນນະພາບຂອງ CF" />
                <dl className="grid grid-cols-2 gap-3 p-4 text-sm">
                  <div>
                    <dt className="text-2xs text-[var(--fg-subtle)]">CF ທັງໝົດ</dt>
                    <dd className="tnum font-semibold">{formatInt(a.cfComments)}</dd>
                  </div>
                  <div>
                    <dt className="text-2xs text-[var(--fg-subtle)]">ອ່ານລະຫັດບໍ່ອອກ</dt>
                    <dd className="tnum font-semibold">{formatInt(a.unmatched)}</dd>
                  </div>
                  <div>
                    <dt className="text-2xs text-[var(--fg-subtle)]">CF ຊ້ຳ</dt>
                    <dd className="tnum font-semibold">{formatInt(a.duplicates)}</dd>
                  </div>
                  <div>
                    <dt className="text-2xs text-[var(--fg-subtle)]">CF ໃນຊ່ວງທ້າຍ 25%</dt>
                    <dd className="tnum font-semibold">{formatPercent(a.lateCfShare, 0)}</dd>
                  </div>
                  <div>
                    <dt className="text-2xs text-[var(--fg-subtle)]">ກຳໄລກ່ອນຄ່າ Ads</dt>
                    <dd className="tnum font-semibold">{money(a.money.orderMargin)}</dd>
                  </div>
                </dl>
              </Card>
            </div>
          </div>
        </>
      )}
    </>
  );
}
